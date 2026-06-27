// =====================================================
// Scheduled Trial Expiration Edge Function
// =====================================================
// Runs daily to downgrade expired free trials to the free plan
// Configure as a scheduled function in Supabase Dashboard

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logError } from '../_shared/logger.js'

serve(async (req) => {
  try {
    // Verify this is a scheduled function call (optional security check)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Service role required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase service role client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('[scheduled-trial-expiration] Starting trial expiration check...')

    // Call the database function to downgrade expired trials
    const { data, error } = await supabase.rpc('downgrade_expired_trials')

    if (error) {
      logError(error, { functionName: 'scheduled-trial-expiration', context: 'downgrade_expired_trials' })
      return new Response(
        JSON.stringify({ error: 'Failed to process trial expirations' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get count of locked subscriptions for logging
    const { count } = await supabase
      .from('organization_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'paused')

    console.log(`[scheduled-trial-expiration] Successfully processed. Locked ${count || 0} organizations.`)

    return new Response(
      JSON.stringify({
        success: true,
        locked_count: count || 0,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logError(error, { functionName: 'scheduled-trial-expiration' })
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
