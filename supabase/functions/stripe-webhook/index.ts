// =====================================================
// Stripe Webhook Handler Edge Function
// =====================================================
// Handles Stripe webhook events and syncs subscription state

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.8.0?target=deno'
import { logError } from '../_shared/logger.js'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
if (!STRIPE_SECRET_KEY) throw new Error('Missing required env var: STRIPE_SECRET_KEY')

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
if (!STRIPE_WEBHOOK_SECRET) throw new Error('Missing required env var: STRIPE_WEBHOOK_SECRET')

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = STRIPE_WEBHOOK_SECRET

// Helper function to validate UUIDs
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event

  try {
    // Verify webhook signature
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    logError(err, { functionName: 'stripe-webhook', context: 'signature_verification' })
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  // Create Supabase service role client (bypasses RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  console.log(`[stripe-webhook] Received event: ${event.type} (${event.id})`)

  // Check for duplicate webhook events (idempotency)
  const { data: existingEvent } = await supabase
    .from('billing_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single()

  if (existingEvent) {
    console.log(`[stripe-webhook] Event ${event.id} already processed, skipping`)
    return new Response(JSON.stringify({ received: true, status: 'already_processed' }), { status: 200 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(supabase, event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error) {
    logError(error, { functionName: 'stripe-webhook', eventType: event.type, eventId: event.id })

    // Store failed webhook for debugging
    try {
      await supabase.from('failed_webhooks').insert({
        stripe_event_id: event.id,
        event_type: event.type,
        error_message: error instanceof Error ? error.message : String(error),
        event_data: event,
      })
    } catch (dbError) {
      logError(dbError, { functionName: 'stripe-webhook', context: 'failed_webhook_insert' })
    }

    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), { status: 500 })
  }
})

// =====================================================
// Event Handlers
// =====================================================

async function handleCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organization_id
  const planId = session.metadata?.plan_id

  if (!organizationId || !planId) {
    console.error('[stripe-webhook] Missing metadata in checkout session')
    return
  }

  // Validate UUID format
  if (!isValidUUID(organizationId)) {
    console.error(`[stripe-webhook] Invalid organization_id format: ${organizationId}`)
    return
  }

  console.log(`[stripe-webhook] Checkout completed for org ${organizationId}, plan ${planId}`)

  // Update subscription with Stripe IDs and set to active
  const { error } = await supabase
    .from('organization_subscriptions')
    .update({
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      plan_id: planId,
      status: 'active',
      current_period_start: new Date().toISOString(),
      // Will be updated by subscription.updated event with actual dates
    })
    .eq('organization_id', organizationId)

  if (error) {
    console.error('[stripe-webhook] Failed to update subscription:', error)
    return
  }

  // Log billing event
  await supabase.from('billing_events').insert({
    organization_id: organizationId,
    event_type: 'payment_succeeded',
    to_plan_id: planId,
    stripe_event_id: session.id,
    details: {
      amount: session.amount_total,
      currency: session.currency,
    },
  })

  console.log(`[stripe-webhook] Subscription updated successfully for org ${organizationId}`)
}

async function handleSubscriptionUpdated(supabase: any, subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organization_id

  if (!organizationId) {
    console.error('[stripe-webhook] Missing organization_id in subscription metadata')
    return
  }

  // Validate UUID format
  if (!isValidUUID(organizationId)) {
    console.error(`[stripe-webhook] Invalid organization_id format: ${organizationId}`)
    return
  }

  console.log(`[stripe-webhook] Subscription updated for org ${organizationId}, status: ${subscription.status}`)

  // Determine plan_id from Stripe subscription
  let planId = subscription.metadata?.plan_id

  if (!planId) {
    const meteredPriceIdEnv = Deno.env.get('STRIPE_METERED_PROXY_PRICE_ID')

    // Step 1: check lookup_key on the subscription plan item (not the metered proxy item)
    const planItem = subscription.items.data.find(
      (item) => item.price.lookup_key === 'pro_monthly' || item.price.lookup_key === 'pro_annual'
    )
    if (planItem?.price.lookup_key) {
      planId = planItem.price.lookup_key
      console.log(`[stripe-webhook] Resolved plan_id via lookup key: ${planId}`)
    }

    // Step 2: legacy fallback — match DB stripe_price_id, skipping the metered proxy price
    if (!planId) {
      const legacyItem = subscription.items.data.find(
        (item) => !meteredPriceIdEnv || item.price.id !== meteredPriceIdEnv
      )
      const priceId = legacyItem?.price.id

      if (priceId) {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('id')
          .eq('stripe_price_id', priceId)
          .single()

        if (plan) {
          planId = plan.id
          console.log(`[stripe-webhook] Resolved plan_id via legacy DB price match: ${planId}`)
        }
      }
    }
  }

  // Extract metered proxy item ID if present
  const meteredPriceId = Deno.env.get('STRIPE_METERED_PROXY_PRICE_ID')
  let proxyMeteredItemId: string | null = null
  if (meteredPriceId) {
    const meteredItem = subscription.items.data.find(item => item.price.id === meteredPriceId)
    if (meteredItem) {
      proxyMeteredItemId = meteredItem.id
    }
  }

  if (!planId) {
    console.warn(`[stripe-webhook] Could not determine plan_id for subscription ${subscription.id}, skipping plan_id update`)
  }

  const updatePayload: Record<string, unknown> = {
    plan_id: planId || undefined,
    status: subscription.status,
    current_period_start: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    trial_start_date: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
    trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
  }

  // Only update proxy_metered_item_id if we found/didn't find the metered item
  if (meteredPriceId) {
    updatePayload.proxy_metered_item_id = proxyMeteredItemId
  }

  const { error } = await supabase
    .from('organization_subscriptions')
    .update(updatePayload)
    .eq('organization_id', organizationId)

  if (error) {
    console.error('[stripe-webhook] Failed to update subscription:', error)
    return
  }

  // Log event
  await supabase.from('billing_events').insert({
    organization_id: organizationId,
    event_type: 'subscription_updated',
    stripe_event_id: subscription.id,
    details: {
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
  })

  console.log(`[stripe-webhook] Subscription state synced for org ${organizationId}`)
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organization_id

  if (!organizationId) {
    console.error('[stripe-webhook] Missing organization_id in subscription metadata')
    return
  }

  // Validate UUID format
  if (!isValidUUID(organizationId)) {
    console.error(`[stripe-webhook] Invalid organization_id format: ${organizationId}`)
    return
  }

  console.log(`[stripe-webhook] Subscription deleted for org ${organizationId}`)

  // Lock the org (paused) and clear Stripe-specific fields; do NOT change plan_id
  const { error } = await supabase
    .from('organization_subscriptions')
    .update({
      status: 'paused',
      stripe_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      canceled_at: new Date().toISOString(),
      proxy_metered_item_id: null,
    })
    .eq('organization_id', organizationId)

  if (error) {
    console.error('[stripe-webhook] Failed to lock subscription:', error)
    return
  }

  // Log event
  await supabase.from('billing_events').insert({
    organization_id: organizationId,
    event_type: 'subscription_canceled',
    stripe_event_id: subscription.id,
    details: {
      reason: 'subscription_deleted_locked',
    },
  })

  console.log(`[stripe-webhook] Organization ${organizationId} locked (subscription deleted)`)
}

async function handlePaymentSucceeded(supabase: any, invoice: Stripe.Invoice) {
  const subscription = invoice.subscription

  if (!subscription || typeof subscription !== 'string') {
    return
  }

  // Get subscription metadata
  const stripeSubscription = await stripe.subscriptions.retrieve(subscription)
  const organizationId = stripeSubscription.metadata?.organization_id

  if (!organizationId) {
    return
  }

  // Validate UUID format
  if (!isValidUUID(organizationId)) {
    console.error(`[stripe-webhook] Invalid organization_id format: ${organizationId}`)
    return
  }

  console.log(`[stripe-webhook] Payment succeeded for org ${organizationId}`)

  // Ensure subscription is active
  await supabase
    .from('organization_subscriptions')
    .update({ status: 'active' })
    .eq('organization_id', organizationId)

  // Log event
  await supabase.from('billing_events').insert({
    organization_id: organizationId,
    event_type: 'payment_succeeded',
    stripe_event_id: invoice.id,
    details: {
      amount: invoice.amount_paid,
      currency: invoice.currency,
      invoice_id: invoice.id,
      invoice_number: invoice.number,
    },
  })
}

async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const subscription = invoice.subscription

  if (!subscription || typeof subscription !== 'string') {
    return
  }

  // Get subscription metadata
  const stripeSubscription = await stripe.subscriptions.retrieve(subscription)
  const organizationId = stripeSubscription.metadata?.organization_id

  if (!organizationId) {
    return
  }

  // Validate UUID format
  if (!isValidUUID(organizationId)) {
    console.error(`[stripe-webhook] Invalid organization_id format: ${organizationId}`)
    return
  }

  console.log(`[stripe-webhook] Payment failed for org ${organizationId}`)

  // Update subscription status to past_due
  await supabase
    .from('organization_subscriptions')
    .update({ status: 'past_due' })
    .eq('organization_id', organizationId)

  // Log event
  await supabase.from('billing_events').insert({
    organization_id: organizationId,
    event_type: 'payment_failed',
    stripe_event_id: invoice.id,
    details: {
      amount: invoice.amount_due,
      currency: invoice.currency,
      invoice_id: invoice.id,
      attempt_count: invoice.attempt_count,
    },
  })
}
