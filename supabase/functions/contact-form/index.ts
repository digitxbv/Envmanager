// =====================================================
// Contact Form Edge Function
// =====================================================
// Sends contact form submissions via Mailgun (prod) or Inbucket (local dev)
// No authentication required — public endpoint

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { jsonResponse, errorResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'

const CONTACT_EMAIL = Deno.env.get('CONTACT_EMAIL') || 'support@envmanager.com'

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function isLocalDev(): boolean {
  const env = Deno.env.get('ENVIRONMENT')
  return !env || env === 'development'
}

async function sendViaInbucket(to: string, subject: string, html: string, text: string) {
  const response = await fetch('http://inbucket:9000/api/v1/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      from: 'EnvManager Contact <noreply@localhost>',
      subject,
      html,
      text,
    }),
  })
  if (!response.ok) {
    throw new Error(`Inbucket error: ${response.status}`)
  }
}

async function sendViaMailgun(to: string, subject: string, html: string, text: string) {
  const apiKey = Deno.env.get('MAILGUN_API_KEY')
  const domain = Deno.env.get('MAILGUN_DOMAIN')
  const region = Deno.env.get('MAILGUN_REGION') || 'eu'
  const fromEmail = Deno.env.get('MAILGUN_FROM_EMAIL') || 'EnvManager <noreply@envmanager.com>'

  if (!apiKey || !domain) {
    throw new Error('Mailgun configuration missing')
  }

  const baseUrl = region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'

  const formData = new FormData()
  formData.append('from', fromEmail)
  formData.append('to', to)
  formData.append('subject', subject)
  formData.append('html', html)
  formData.append('text', text)

  const response = await fetch(`${baseUrl}/v3/${domain}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`api:${apiKey}`)}` },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Mailgun error: ${response.status} - ${errorText}`)
  }
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', corsHeaders, 405)
  }

  try {
    const { name, email, subject, message } = await req.json()

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return errorResponse('All fields are required', corsHeaders, 400)
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return errorResponse('Invalid email address', corsHeaders, 400)
    }

    if (name.length > 200 || email.length > 254 || subject.length > 500 || message.length > 5000) {
      return errorResponse('Input too long', corsHeaders, 400)
    }

    const safeName = escapeHtml(name.trim())
    const safeEmail = escapeHtml(email.trim())
    const safeSubject = escapeHtml(subject.trim())
    const safeMessage = escapeHtml(message.trim())

    const htmlBody = `
      <h2>New Contact Form Submission</h2>
      <p><strong>From:</strong> ${safeName} (${safeEmail})</p>
      <p><strong>Subject:</strong> ${safeSubject}</p>
      <hr>
      <p>${safeMessage.replace(/\n/g, '<br>')}</p>
    `

    const textBody = `New Contact Form Submission\n\nFrom: ${name.trim()} (${email.trim()})\nSubject: ${subject.trim()}\n\n${message.trim()}`

    const emailSubject = `[EnvManager Contact] ${subject.trim()}`

    if (isLocalDev()) {
      await sendViaInbucket(CONTACT_EMAIL, emailSubject, htmlBody, textBody)
    } else {
      await sendViaMailgun(CONTACT_EMAIL, emailSubject, htmlBody, textBody)
    }

    return jsonResponse({ success: true }, corsHeaders)
  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
