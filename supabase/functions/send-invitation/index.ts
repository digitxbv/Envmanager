// =====================================================
// Send Invitation Edge Function
// =====================================================
// Sends invitation emails via Mailgun
// Requires environment variables:
// - MAILGUN_API_KEY
// - MAILGUN_DOMAIN
// - MAILGUN_REGION (optional: 'us' or 'eu', defaults to 'eu')
// - MAILGUN_FROM_EMAIL (e.g., "EnvManager <noreply@envmanager.com>")
// - APP_URL (e.g., "https://envmanager.com" or "http://localhost:4400")

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { getCorsHeaders } from '../_shared/cors.js'
import { jsonResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { requireEnv } from '../_shared/require-env.ts'
import { sendEmail } from '../_shared/email.ts'

// =====================================================
// Types
// =====================================================

interface InvitationPayload {
  email: string
  organizationName: string
  inviterName: string
  role: string
  token: string
}

// =====================================================
// Security Helpers
// =====================================================

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function validatePayload(payload: any): payload is InvitationPayload {
  return payload &&
    typeof payload.email === 'string' &&
    typeof payload.organizationName === 'string' &&
    typeof payload.inviterName === 'string' &&
    typeof payload.role === 'string' &&
    typeof payload.token === 'string' &&
    payload.email.includes('@') &&
    (payload.role === 'admin' || payload.role === 'member' || payload.role === 'viewer')
}

// =====================================================
// Email Templates
// =====================================================

function getHtmlTemplate(payload: InvitationPayload, inviteUrl: string): string {
  const roleLabel = payload.role === 'admin' ? 'Administrator' : payload.role === 'viewer' ? 'Viewer' : 'Member'

  // Sanitize user-provided data
  const safeOrgName = escapeHtml(payload.organizationName)
  const safeInviterName = escapeHtml(payload.inviterName)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're Invited to Join ${payload.organizationName}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f7;
            color: #1d1d1f;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
        }
        .header {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            color: #ffffff;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #1d1d1f;
        }
        .message {
            font-size: 16px;
            line-height: 1.6;
            color: #424245;
            margin-bottom: 30px;
        }
        .cta-button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .details-box {
            background-color: #f5f5f7;
            border-left: 4px solid #6366f1;
            padding: 16px 20px;
            margin: 30px 0;
            border-radius: 4px;
        }
        .details-box p {
            margin: 8px 0;
            font-size: 14px;
            color: #424245;
        }
        .details-box strong {
            color: #1d1d1f;
        }
        .expiry-notice {
            font-size: 14px;
            color: #86868b;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e7;
        }
        .footer {
            background-color: #f5f5f7;
            padding: 30px;
            text-align: center;
            font-size: 13px;
            color: #86868b;
        }
        .footer a {
            color: #6366f1;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 You're Invited!</h1>
        </div>
        <div class="content">
            <p class="greeting">Hi there,</p>
            <p class="message">
                <strong>${safeInviterName}</strong> has invited you to join
                <strong>${safeOrgName}</strong> on EnvManager.
            </p>

            <div class="details-box">
                <p><strong>Organization:</strong> ${safeOrgName}</p>
                <p><strong>Role:</strong> ${roleLabel}</p>
                <p><strong>Invited by:</strong> ${safeInviterName}</p>
            </div>

            <p class="message">
                As a ${roleLabel.toLowerCase()}, you'll be able to collaborate on projects,
                manage environment variables, and work with your team securely.
            </p>

            <div style="text-align: center; margin: 40px 0;">
                <a href="${inviteUrl}" class="cta-button">Accept Invitation</a>
            </div>

            <p class="message" style="font-size: 14px; color: #86868b;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteUrl}" style="color: #6366f1; word-break: break-all;">${inviteUrl}</a>
            </p>

            <p class="expiry-notice">
                ⏰ This invitation expires in 24 hours. If the link has expired,
                please contact ${safeInviterName} to send a new invitation.
            </p>
        </div>
        <div class="footer">
            <p>
                This email was sent by EnvManager<br>
                <a href="${Deno.env.get('APP_URL') || 'https://envmanager.com'}">Visit EnvManager</a>
            </p>
        </div>
    </div>
</body>
</html>
  `.trim()
}

function getTextTemplate(payload: InvitationPayload, inviteUrl: string): string {
  const roleLabel = payload.role === 'admin' ? 'Administrator' : payload.role === 'viewer' ? 'Viewer' : 'Member'

  // Sanitize user-provided data (text version - no HTML entities needed)
  const safeOrgName = payload.organizationName.replace(/[<>]/g, '')
  const safeInviterName = payload.inviterName.replace(/[<>]/g, '')

  return `
You're Invited to Join ${safeOrgName}!

Hi there,

${safeInviterName} has invited you to join ${safeOrgName} on EnvManager.

Organization: ${safeOrgName}
Role: ${roleLabel}
Invited by: ${safeInviterName}

As a ${roleLabel.toLowerCase()}, you'll be able to collaborate on projects, manage environment variables, and work with your team securely.

Accept your invitation:
${inviteUrl}

⏰ This invitation expires in 24 hours. If the link has expired, please contact ${safeInviterName} to send a new invitation.

---
This email was sent by EnvManager
${Deno.env.get('APP_URL') || 'https://envmanager.com'}
  `.trim()
}

// =====================================================
// Main Handler
// =====================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Invalid authentication token')
    }

    // Parse request body
    const rawPayload = await req.json()

    // Validate payload structure and types
    if (!validatePayload(rawPayload)) {
      console.error('[send-invitation] Invalid payload structure:', rawPayload)
      throw new Error('Invalid payload structure or missing required fields')
    }

    const payload: InvitationPayload = rawPayload

    // Build invitation URL
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:4400'
    const inviteUrl = `${appUrl}/auth/accept-invite?token=${payload.token}`

    // Generate email content
    const subject = `You're invited to join ${payload.organizationName} on EnvManager`
    const htmlBody = getHtmlTemplate(payload, inviteUrl)
    const textBody = getTextTemplate(payload, inviteUrl)

    // Send email (auto-detects local dev vs production)
    const emailResponse = await sendEmail(
      payload.email,
      subject,
      htmlBody,
      textBody
    )

    console.log('Email sent successfully:', {
      email: payload.email,
      emailId: emailResponse.id,
    })

    return jsonResponse({
      success: true,
      message: 'Invitation email sent successfully',
      emailId: emailResponse.id,
    }, corsHeaders)
  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
