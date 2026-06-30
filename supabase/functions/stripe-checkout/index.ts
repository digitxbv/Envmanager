// =====================================================
// Stripe Checkout Edge Function
// =====================================================
// Creates Stripe Checkout sessions for subscription upgrades
//
// NOTE: This function uses publishable/secret keys (non-JWT based).
// Deploy with: supabase functions deploy stripe-checkout --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.8.0?target=deno'
import { getCorsHeaders } from '../_shared/cors.js'
import { jsonResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
if (!STRIPE_SECRET_KEY) throw new Error('Missing required env var: STRIPE_SECRET_KEY')

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  // Reject non-POST (except OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const corsHeaders = getCorsHeaders(req)

  try {
    // Validate apikey header (publishable/secret key - non-JWT based)
    const apikey = req.headers.get('apikey')
    const expectedKey = Deno.env.get('PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!apikey || apikey !== expectedKey) {
      throw new Error('Invalid API key')
    }

    // Create Supabase client with user's auth
    // Note: Authorization header still contains user JWT for authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      expectedKey,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const { organizationId, planId, successUrl, cancelUrl, customerEmail } = await req.json()

    // Verify user is member of organization with admin rights
    const { data: membership, error: membershipError } = await supabaseClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Unauthorized: Only owners and admins can manage billing')
    }

    // Get organization and subscription data
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('stripe_customer_id, billing_email, name')
      .eq('id', organizationId)
      .single()

    if (orgError) throw orgError

    // Get or create Stripe customer
    let customerId = org.stripe_customer_id

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: customerEmail || org.billing_email || user.email,
        name: org.name,
        metadata: {
          organization_id: organizationId,
          user_id: user.id,
        },
      })

      customerId = customer.id

      // Update organization with customer ID
      await supabaseClient
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', organizationId)
    }

    // Get plan details (validates plan exists and is active; stripe_price_id used as fallback only)
    const { data: plan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      throw new Error('Invalid plan')
    }

    // Resolve Stripe price via lookup key (primary) or DB stripe_price_id (fallback)
    let resolvedPriceId: string | undefined

    try {
      const prices = await stripe.prices.list({ lookup_keys: [planId], active: true, limit: 1 })
      resolvedPriceId = prices.data[0]?.id
      if (resolvedPriceId) {
        console.log(`[stripe-checkout] Resolved price via lookup key '${planId}': ${resolvedPriceId}`)
      }
    } catch (lookupErr) {
      console.log(`[stripe-checkout] Lookup key resolution failed, falling back to DB price ID: ${lookupErr}`)
    }

    if (!resolvedPriceId && plan.stripe_price_id) {
      resolvedPriceId = plan.stripe_price_id
      console.log(`[stripe-checkout] Resolved price via DB fallback for plan '${planId}': ${resolvedPriceId}`)
    }

    if (!resolvedPriceId) {
      throw new Error('No active Stripe price found for plan')
    }

    // Validate redirect URLs against allowed origins (server-side list only)
    const allowedOrigins = ['https://envmanager.com', 'https://app.envmanager.com', 'http://localhost:4400']

    function isAllowedUrl(url: string | undefined): boolean {
      if (!url) return true // Will use default
      try {
        const parsed = new URL(url)
        return allowedOrigins.some((o) => parsed.origin === o)
      } catch {
        return false
      }
    }

    if (!isAllowedUrl(successUrl) || !isAllowedUrl(cancelUrl)) {
      throw new Error('Invalid redirect URL: must match the request origin')
    }

    // Build line items — include metered proxy price if configured
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: resolvedPriceId,
        quantity: 1,
      },
    ]

    const meteredPriceId = Deno.env.get('STRIPE_METERED_PROXY_PRICE_ID')
    if (meteredPriceId && planId !== 'free') {
      lineItems.push({ price: meteredPriceId })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: lineItems,
      mode: 'subscription',
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto' },
      success_url: successUrl || `${req.headers.get('origin')}/dashboard/billing?success=true`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/dashboard/billing?canceled=true`,
      metadata: {
        organization_id: organizationId,
        plan_id: planId,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          organization_id: organizationId,
          plan_id: planId,
        },
      },
      allow_promotion_codes: true,
    })

    return jsonResponse({ url: session.url }, corsHeaders)
  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
