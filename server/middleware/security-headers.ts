export default defineEventHandler((event) => {
  setHeader(event, 'X-Frame-Options', 'DENY')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-XSS-Protection', '1; mode=block')
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  if (process.env.NODE_ENV === 'production') {
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  const isDev = process.env.NODE_ENV !== 'production'
  const selfHosted = process.env.EM_SELF_HOSTED === 'true'

  // Browser-facing Supabase origin. When self-hosting this is the operator's OWN
  // domain (not *.supabase.co), so derive it from the public env and allow it —
  // plus its websocket origin for Realtime. Without this the CSP blocks every
  // Supabase request and the app cannot function self-hosted.
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const supabaseOrigins: string[] = []
  try {
    if (supabaseUrl) {
      const u = new URL(supabaseUrl)
      const ws = u.protocol === 'https:' ? 'wss:' : 'ws:'
      supabaseOrigins.push(`${u.protocol}//${u.host}`, `${ws}//${u.host}`)
    }
  } catch { /* ignore a malformed URL — fall back to no extra origin */ }

  // SaaS-only third parties (managed Supabase, analytics, consent, support
  // widgets). Off when self-hosting, so drop them for a tighter policy.
  const saasConnect = selfHosted ? [] : [
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://eu.i.posthog.com',
    'https://eu-assets.i.posthog.com',
    'https://e.envmanager.com',
    'https://consent.cookiebot.com',
    'https://consentcdn.cookiebot.com',
    'https://*.productfruits.com',
    'wss://*.productfruits.com',
    'https://productfruits.help/',
    'https://*.ingest.sentry.io',
  ]

  const connectSrc = [
    "'self'",
    ...supabaseOrigins,
    ...saasConnect,
    ...(isDev ? ['http://127.0.0.1:54431', 'http://localhost:54431', 'http://localhost:4400', 'ws://localhost:4400', 'ws://localhost:4001'] : []),
  ].join(' ')

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    ...(selfHosted ? [] : [
      'https://www.googletagmanager.com',
      'https://eu-assets.i.posthog.com',
      'https://e.envmanager.com',
      'https://consent.cookiebot.com',
      'https://consentcdn.cookiebot.com',
      'https://*.productfruits.com',
    ]),
  ].join(' ')

  const imgSrc = [
    "'self'",
    'data:',
    'https:',
    ...supabaseOrigins,
    ...(selfHosted ? [] : [
      'https://www.googletagmanager.com',
      'https://consent.cookiebot.com',
      'https://consentcdn.cookiebot.com',
      'https://imgsct.cookiebot.com',
      'https://*.productfruits.com',
      'https://*.supabase.co',
    ]),
  ].join(' ')

  const styleSrc = selfHosted
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' https://*.productfruits.com"
  const frameSrc = selfHosted
    ? "'self'"
    : "'self' https://*.productfruits.com https://consent.cookiebot.com https://consentcdn.cookiebot.com"

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  setHeader(event, 'Content-Security-Policy', csp)
})
