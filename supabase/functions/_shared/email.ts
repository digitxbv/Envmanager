// =====================================================
// Shared email sender: Mailpit (local) / Mailgun (prod)
// =====================================================

export interface EmailSendResult {
  id: string
  message: string
}

async function sendEmailViaMailpit(to: string, subject: string, htmlBody: string, textBody: string): Promise<EmailSendResult> {
  const mailpitUrl = 'http://inbucket:9000/api/v1/message'
  const response = await fetch(mailpitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, from: 'EnvManager <noreply@localhost>', subject, html: htmlBody, text: textBody }),
  })
  if (!response.ok) {
    const errorText = await response.text()
    console.error('[email] Mailpit/Inbucket error:', errorText)
    throw new Error(`Email send error: ${response.status} - ${errorText}`)
  }
  return { id: 'local-dev-' + Date.now(), message: 'Email sent to local Mailpit' }
}

async function sendEmailViaMailgun(to: string, subject: string, htmlBody: string, textBody: string): Promise<EmailSendResult> {
  const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY')
  const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN')
  const mailgunRegion = Deno.env.get('MAILGUN_REGION') || 'eu'
  const fromEmail = Deno.env.get('MAILGUN_FROM_EMAIL') || 'EnvManager <noreply@envmanager.com>'
  if (!mailgunApiKey || !mailgunDomain) {
    throw new Error('Mailgun configuration missing. Set MAILGUN_API_KEY and MAILGUN_DOMAIN.')
  }
  const apiBaseUrl = mailgunRegion === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'
  const formData = new FormData()
  formData.append('from', fromEmail)
  formData.append('to', to)
  formData.append('subject', subject)
  formData.append('html', htmlBody)
  formData.append('text', textBody)
  const auth = btoa(`api:${mailgunApiKey}`)
  const response = await fetch(`${apiBaseUrl}/v3/${mailgunDomain}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}` },
    body: formData,
  })
  if (!response.ok) {
    const errorText = await response.text()
    console.error('[email] Mailgun error:', errorText)
    throw new Error(`Mailgun API error: ${response.status} - ${errorText}`)
  }
  return await response.json()
}

export async function sendEmail(to: string, subject: string, htmlBody: string, textBody: string): Promise<EmailSendResult> {
  const isLocalDev = Deno.env.get('ENVIRONMENT') === 'local' ||
    Deno.env.get('SUPABASE_URL')?.includes('localhost') ||
    Deno.env.get('SUPABASE_URL')?.includes('127.0.0.1')
  console.log('[email] Environment:', isLocalDev ? 'LOCAL DEV' : 'PRODUCTION')
  if (isLocalDev) {
    return await sendEmailViaMailpit(to, subject, htmlBody, textBody)
  }
  // Self-hosted instances may run without an email provider. In that case skip
  // the send gracefully instead of throwing, so the calling flow (e.g. creating
  // an invitation) still succeeds and the operator can share the link manually.
  // A configured-but-failing Mailgun still errors inside sendEmailViaMailgun.
  if (!Deno.env.get('MAILGUN_API_KEY') || !Deno.env.get('MAILGUN_DOMAIN')) {
    console.warn('[email] No email provider configured (MAILGUN_API_KEY/DOMAIN unset); skipping send.')
    return { id: 'skipped-no-provider', message: 'Email not sent: no email provider configured' }
  }
  return await sendEmailViaMailgun(to, subject, htmlBody, textBody)
}
