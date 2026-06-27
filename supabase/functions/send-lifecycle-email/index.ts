import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { jsonResponse, errorResponse } from '../_shared/response.ts'
import { sendLifecycleEmail } from '../_shared/send-lifecycle.ts'

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse('Missing Authorization', cors, 401)

    // Resolve the caller from their JWT — service role client + getUser(jwt).
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt)
    if (userErr || !user?.email) return errorResponse('Unauthorized', cors, 401)

    const body = await req.json().catch(() => ({}))
    if (body?.email_type !== 'welcome') {
      return errorResponse('Only the welcome email may be sent via this endpoint', cors, 400)
    }

    const outcome = await sendLifecycleEmail(supabase, {
      userId: user.id, email: user.email, emailType: 'welcome',
    })
    return jsonResponse({ outcome }, cors)
  } catch (err) {
    console.error('[send-lifecycle-email] error:', err instanceof Error ? err.message : err)
    return errorResponse('An unexpected error occurred', cors, 500)
  }
})
