// =====================================================
// sendLifecycleEmail — single send path for every lifecycle email.
// Order: idempotency → suppression → render → send → log.
// On send failure, NO log row is written so the daily batch can retry.
// =====================================================

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from './email.ts'
import { makeUnsubscribeUrl, renderLifecycleEmail, type LifecycleEmailType } from './lifecycle-emails.ts'
import { requireEnv } from './require-env.ts'

export type SendOutcome = 'sent' | 'suppressed' | 'already_sent' | 'error'

export async function sendLifecycleEmail(
  supabase: SupabaseClient,
  params: { userId: string; email: string; emailType: LifecycleEmailType },
): Promise<SendOutcome> {
  const { userId, email, emailType } = params

  // 1. Idempotency — already logged for this (user, type)?
  const { data: existing } = await supabase
    .from('lifecycle_email_log')
    .select('id')
    .eq('user_id', userId)
    .eq('email_type', emailType)
    .maybeSingle()
  if (existing) return 'already_sent'

  // 2. Suppression — unsubscribed from marketing email?
  const { data: pref } = await supabase
    .from('email_preferences')
    .select('marketing_unsubscribed_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (pref?.marketing_unsubscribed_at) {
    await supabase.from('lifecycle_email_log').upsert({
      user_id: userId, email_type: emailType, status: 'suppressed',
    }, { onConflict: 'user_id,email_type', ignoreDuplicates: true })
    return 'suppressed'
  }

  // 3. Render
  const appUrl = Deno.env.get('APP_URL') || 'https://envmanager.com'
  const secret = requireEnv('EMAIL_UNSUBSCRIBE_SECRET')
  const unsubscribeUrl = await makeUnsubscribeUrl(userId, appUrl, secret)
  const { subject, html, text } = renderLifecycleEmail(emailType, { appUrl, unsubscribeUrl })

  // 4. Send — on failure write NOTHING so the next batch retries within the day-band.
  let providerId: string
  try {
    const result = await sendEmail(email, subject, html, text)
    providerId = result.id
  } catch (err) {
    console.error(`[send-lifecycle] send failed for ${emailType}/${userId}:`, err instanceof Error ? err.message : err)
    return 'error'
  }

  // 5. Log success
  await supabase.from('lifecycle_email_log').upsert({
    user_id: userId, email_type: emailType, status: 'sent', provider_message_id: providerId,
  }, { onConflict: 'user_id,email_type', ignoreDuplicates: true })
  return 'sent'
}
