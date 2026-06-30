// =====================================================
// Report Proxy Usage Edge Function
// =====================================================
// Reports proxy invocation overage to Stripe for metered billing.
// Intended to run via pg_cron on the 1st of each month at 00:05 UTC.
// Can also be triggered manually by an admin action.
//
// Deploy with: supabase functions deploy report-proxy-usage --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.8.0?target=deno'
import { logError } from '../_shared/logger.js'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
if (!STRIPE_SECRET_KEY) throw new Error('Missing required env var: STRIPE_SECRET_KEY')

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Allow cron or admin trigger via service role key (timing-safe comparison)
  const authHeader = req.headers.get('Authorization')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const expected = `Bearer ${serviceRoleKey}`
  const encoder = new TextEncoder()
  const givenBytes = encoder.encode(authHeader ?? '')
  const expectedBytes = encoder.encode(expected)
  if (givenBytes.byteLength !== expectedBytes.byteLength ||
      !crypto.subtle.timingSafeEqual(givenBytes, expectedBytes)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey
  )

  // Default: previous month
  const body = await req.json().catch(() => ({}))
  const period: string = body.period ?? getPreviousMonthPeriod()

  // Validate period format
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return new Response(JSON.stringify({ error: 'Invalid period format. Expected YYYY-MM' }), { status: 400 })
  }

  console.log(`[report-proxy-usage] Reporting overage for period: ${period}`)

  // Fetch all orgs with a metered subscription item
  const { data: subscriptions, error: subError } = await supabase
    .from('organization_subscriptions')
    .select('organization_id, proxy_metered_item_id, plan_id')
    .not('proxy_metered_item_id', 'is', null)

  if (subError) {
    logError(subError, { functionName: 'report-proxy-usage', context: 'fetch_subscriptions' })
    return new Response(JSON.stringify({ error: subError.message }), { status: 500 })
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('[report-proxy-usage] No orgs with metered subscription items, done.')
    return new Response(JSON.stringify({ reported: 0, skipped: 0 }), { status: 200 })
  }

  // Fetch plan limits to know the included quota
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id, limits')

  const planLimitMap: Record<string, number> = {}
  for (const plan of plans ?? []) {
    const limits = plan.limits as Record<string, unknown> | null
    planLimitMap[plan.id] = (limits?.proxy_invocations_monthly as number) ?? 0
  }

  let reported = 0
  let skipped = 0

  for (const sub of subscriptions) {
    const orgId = sub.organization_id
    const meteredItemId = sub.proxy_metered_item_id
    const includedLimit = planLimitMap[sub.plan_id] ?? 0

    try {
      // Check if already reported for this period
      const { data: existing } = await supabase
        .from('proxy_invocations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('period', period)
        .eq('overage_reported', true)
        .limit(1)
        .single()

      if (existing) {
        console.log(`[report-proxy-usage] Overage already reported for org ${orgId} period ${period}, skipping`)
        skipped++
        continue
      }

      // Calculate overage
      const { data: overageData, error: overageError } = await supabase
        .rpc('get_proxy_overage', {
          p_organization_id: orgId,
          p_period: period,
          p_included_limit: includedLimit,
        })

      if (overageError) {
        logError(overageError, { functionName: 'report-proxy-usage', context: 'get_overage', orgId })
        skipped++
        continue
      }

      const overage = overageData?.overage ?? 0

      if (overage <= 0) {
        console.log(`[report-proxy-usage] No overage for org ${orgId} period ${period}, skipping`)
        skipped++
        continue
      }

      // Report to Stripe (with idempotency key to prevent double-billing)
      await stripe.subscriptionItems.createUsageRecord(meteredItemId, {
        quantity: overage,
        timestamp: 'now',
        action: 'set',
      }, {
        idempotencyKey: `${orgId}-${period}`,
      })

      console.log(`[report-proxy-usage] Reported ${overage} overage calls to Stripe for org ${orgId}`)

      // Mark overage as reported
      await supabase
        .from('proxy_invocations')
        .update({
          overage_reported: true,
          overage_reported_at: new Date().toISOString(),
        })
        .eq('organization_id', orgId)
        .eq('period', period)

      // Log billing event
      await supabase.from('billing_events').insert({
        organization_id: orgId,
        event_type: 'proxy_overage_reported',
        details: {
          period,
          overage,
          metered_item_id: meteredItemId,
        },
      })

      reported++
    } catch (err) {
      logError(err, { functionName: 'report-proxy-usage', context: 'process_org', orgId })
      skipped++
    }
  }

  console.log(`[report-proxy-usage] Done. Reported: ${reported}, Skipped: ${skipped}`)
  return new Response(JSON.stringify({ reported, skipped, period }), { status: 200 })
})

function getPreviousMonthPeriod(): string {
  const now = new Date()
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const month = now.getMonth() === 0 ? 12 : now.getMonth()
  return `${year}-${String(month).padStart(2, '0')}`
}
