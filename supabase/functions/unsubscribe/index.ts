import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { jsonResponse, errorResponse } from '../_shared/response.ts'
import { verifyUnsubscribeToken } from '../_shared/lifecycle-emails.ts'
import { requireEnv } from '../_shared/require-env.ts'

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
      ?? (await req.json().catch(() => ({})))?.token
    if (!token) return errorResponse('Missing token', cors, 400)

    const userId = await verifyUnsubscribeToken(token, requireEnv('EMAIL_UNSUBSCRIBE_SECRET'))
    if (!userId) return errorResponse('Invalid or expired link', cors, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { error } = await supabase.from('email_preferences').upsert(
      { user_id: userId, marketing_unsubscribed_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    if (error) {
      console.error('[unsubscribe] upsert error:', error.message)
      return errorResponse('Could not process unsubscribe', cors, 500)
    }
    return jsonResponse({ success: true }, cors)
  } catch (err) {
    console.error('[unsubscribe] error:', err instanceof Error ? err.message : err)
    return errorResponse('An unexpected error occurred', cors, 500)
  }
})
