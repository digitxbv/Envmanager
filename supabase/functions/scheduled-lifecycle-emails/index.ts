import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendLifecycleEmail } from '../_shared/send-lifecycle.ts'
import type { LifecycleEmailType } from '../_shared/lifecycle-emails.ts'

serve(async (req) => {
  try {
    // Service-role guard (same pattern as scheduled-trial-expiration).
    const authHeader = req.headers.get('Authorization')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!authHeader || !authHeader.includes(serviceKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Service role required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey,
    )

    const { data: due, error } = await supabase.rpc('get_due_lifecycle_emails')
    if (error) {
      console.error('[scheduled-lifecycle-emails] RPC error:', error.message)
      return new Response(JSON.stringify({ error: 'Failed to load due emails' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    const counts = { sent: 0, suppressed: 0, already_sent: 0, errors: 0 }
    for (const row of (due ?? []) as Array<{ user_id: string; email: string; email_type: LifecycleEmailType }>) {
      try {
        const outcome = await sendLifecycleEmail(supabase, {
          userId: row.user_id, email: row.email, emailType: row.email_type,
        })
        if (outcome === 'sent') counts.sent++
        else if (outcome === 'suppressed') counts.suppressed++
        else if (outcome === 'already_sent') counts.already_sent++
        else counts.errors++
      } catch (err) {
        counts.errors++
        console.error('[scheduled-lifecycle-emails] row failed:', err instanceof Error ? err.message : err)
      }
    }

    console.log('[scheduled-lifecycle-emails] done', counts)
    return new Response(JSON.stringify({ success: true, ...counts, timestamp: new Date().toISOString() }),
      { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[scheduled-lifecycle-emails] error:', err instanceof Error ? err.message : err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
