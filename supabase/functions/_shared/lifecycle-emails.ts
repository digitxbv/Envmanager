// =====================================================
// Lifecycle Emails — pure helpers (no Deno/IO deps)
// HMAC unsubscribe tokens + email templates.
// =====================================================

export type LifecycleEmailType = 'welcome' | 'how_to_pull' | 'invite_team' | 'trial_ending'

interface RenderCtx {
  appUrl: string
  unsubscribeUrl: string
}

interface RenderedEmail {
  subject: string
  html: string
  text: string
}

// ---------- HMAC unsubscribe token ----------
// Token format: `${userId}.${base64url(HMAC_SHA256(userId, secret))}`

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(userId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId))
  return base64url(new Uint8Array(sig))
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signUnsubscribeToken(userId: string, secret: string): Promise<string> {
  return `${userId}.${await hmac(userId, secret)}`
}

export async function verifyUnsubscribeToken(token: string, secret: string): Promise<string | null> {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const userId = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!userId || !sig) return null
  const expected = await hmac(userId, secret)
  return constantTimeEqual(sig, expected) ? userId : null
}

export async function makeUnsubscribeUrl(userId: string, appUrl: string, secret: string): Promise<string> {
  const token = await signUnsubscribeToken(userId, secret)
  return `${appUrl}/email/unsubscribe?token=${encodeURIComponent(token)}`
}

// ---------- Templates ----------
// Generic copy with no user-controlled interpolation, so no HTML escaping is required.

/**
 * Internal only. `title` and `bodyHtml` are interpolated WITHOUT HTML escaping —
 * callers must pass only static, non-user-controlled strings. Do not export.
 */
function renderShell(title: string, bodyHtml: string, ctx: RenderCtx): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title>
<style>
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f5f5f7;color:#1d1d1f}
.container{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden}
.header{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 30px}
.header h1{margin:0;color:#fff;font-size:24px;font-weight:600}
.content{padding:36px 30px}
.message{font-size:16px;line-height:1.6;color:#424245;margin:0 0 22px}
.cta-button{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#fff !important;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px}
.code{display:block;background:#f5f5f7;border-radius:6px;padding:14px 16px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;color:#1d1d1f;margin:0 0 22px}
.footer{background:#f5f5f7;padding:24px 30px;text-align:center;font-size:13px;color:#86868b}
.footer a{color:#6366f1;text-decoration:none}
</style></head>
<body><div class="container">
<div class="header"><h1>${title}</h1></div>
<div class="content">${bodyHtml}</div>
<div class="footer">
<p>EnvManager — secure environment variable management<br>
<a href="${ctx.appUrl}">${ctx.appUrl}</a></p>
<p style="margin-top:14px">Don't want these tips? <a href="${ctx.unsubscribeUrl}">Unsubscribe</a>.</p>
</div></div></body></html>`
}

function cta(href: string, label: string): string {
  return `<div style="text-align:center;margin:32px 0"><a href="${href}" class="cta-button">${label}</a></div>`
}

function footerText(ctx: RenderCtx): string {
  return `\n\n--\nEnvManager — ${ctx.appUrl}\nUnsubscribe: ${ctx.unsubscribeUrl}`
}

export function renderLifecycleEmail(type: LifecycleEmailType, ctx: RenderCtx): RenderedEmail {
  switch (type) {
    case 'welcome':
      return {
        subject: 'Welcome to EnvManager 🎉',
        html: renderShell('Welcome to EnvManager',
          `<p class="message">Your workspace is ready. EnvManager keeps your environment variables secure and in sync across your team and platforms.</p>
           <p class="message">The fastest way to feel the value: add a few variables, then pull them straight into your project.</p>
           ${cta(`${ctx.appUrl}/dashboard`, 'Open your dashboard')}`, ctx),
        text: `Welcome to EnvManager!\n\nYour workspace is ready. Add a few variables, then pull them into your project.\n\nOpen your dashboard: ${ctx.appUrl}/dashboard${footerText(ctx)}`,
      }
    case 'how_to_pull':
      return {
        subject: 'Pull your variables in one command',
        html: renderShell('Get your variables into your project',
          `<p class="message">Variables only get sticky once they're in your real workflow. From your project directory, run:</p>
           <span class="code">npx @envmanager-cli/cli pull</span>
           <p class="message">That writes your environment to a local <code>.env</code> — no copy-paste, no leaked secrets in chat.</p>
           ${cta(`${ctx.appUrl}/docs`, 'Read the CLI guide')}`, ctx),
        text: `Pull your variables in one command.\n\nFrom your project directory run:\n  npx @envmanager-cli/cli pull\n\nCLI guide: ${ctx.appUrl}/docs${footerText(ctx)}`,
      }
    case 'invite_team':
      return {
        subject: 'Bring your team into EnvManager',
        html: renderShell('Share securely with your team',
          `<p class="message">EnvManager is built for teams. Invite a teammate and stop sharing secrets over Slack or email.</p>
           <p class="message">You control who sees what with per-environment access and a full audit trail.</p>
           ${cta(`${ctx.appUrl}/dashboard/team`, 'Invite a teammate')}`, ctx),
        text: `Bring your team into EnvManager.\n\nInvite a teammate and stop sharing secrets over Slack.\n\nInvite: ${ctx.appUrl}/dashboard/team${footerText(ctx)}`,
      }
    case 'trial_ending':
      return {
        subject: 'Your EnvManager trial ends soon',
        html: renderShell('Your trial ends in a few days',
          `<p class="message">Your EnvManager Pro trial is ending soon. Add a payment method to keep your variables, integrations and team access running without interruption.</p>
           ${cta(`${ctx.appUrl}/dashboard/settings/billing`, 'Keep my workspace')}`, ctx),
        text: `Your EnvManager trial ends soon.\n\nAdd a payment method to keep your workspace running.\n\nBilling: ${ctx.appUrl}/dashboard/settings/billing${footerText(ctx)}`,
      }
    default:
      throw new Error(`Unknown lifecycle email type: ${type}`)
  }
}
