import posthog from 'posthog-js'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

const createMockPostHog = () => ({
  capture: () => {},
  register: () => {},
  identify: () => {},
  people: { set: () => {} },
  isFeatureEnabled: () => false,
  getFeatureFlag: (): unknown => undefined,
  onFeatureFlags: () => {},
  getSurveys: (): unknown[] => [],
  getActiveMatchingSurveys: (): unknown[] => [],
  reset: () => {},
  group: () => {},
  alias: () => {},
  debug: () => {},
  opt_in_capturing: () => {},
  opt_out_capturing: () => {},
  has_opted_out_capturing: () => true,
  set_config: () => {},
  setPersonProperties: () => {},
  startSessionRecording: () => {},
})

type PostHogLike = ReturnType<typeof createMockPostHog> | typeof posthog

declare global {
  interface Window {
    __posthog_instance?: PostHogLike
  }
}

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()

  const posthogPublicKey = runtimeConfig.public.posthogPublicKey as string
  const posthogHost = runtimeConfig.public.posthogHost as string
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const isLocalHost = LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.local')
  const shouldDisableAnalytics = import.meta.dev || isLocalHost

  // Create a mock posthog object when not configured
  const mockPosthog = createMockPostHog()

  // Always provide a safe instance; prefer real posthog if init succeeds
  let instance: PostHogLike = mockPosthog

  if (!posthogPublicKey) {
    console.warn('PostHog public key not configured - using mock implementation')
  } else if (shouldDisableAnalytics) {
    console.info(`[PostHog] Analytics disabled for local environment (${hostname || 'unknown-host'})`)
  } else {
    try {
      const cookieDomain = hostname.endsWith('envmanager.com') ? '.envmanager.com' : undefined

      posthog.init(posthogPublicKey, {
        api_host: posthogHost || 'https://e.envmanager.com',
        ui_host: 'https://eu.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false, // We'll handle this manually for better control
        capture_pageleave: true,
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          // Also surface console.error() calls (not just thrown errors) as
          // $exception events, so client-side errors are queryable in error
          // tracking rather than only visible in a session replay's console.
          capture_console_errors: true,
        },
        // Defense in depth: strip any URL #fragment from every captured event so the
        // secret-share decryption key (on /share/<id>#<key>) can never reach PostHog,
        // even via autocaptured $pageleave/$exception events.
        sanitize_properties: (properties) => {
          const strip = (v: unknown) => (typeof v === 'string' ? v.replace(/#.*$/, '') : v)
          for (const k of ['$current_url', '$pathname', '$referrer', 'path']) {
            if (properties[k] != null) properties[k] = strip(properties[k])
          }
          return properties
        },
        // No cookies by default → basic analytics without GDPR consent
        persistence: 'memory',
        // Session replay disabled until consent — upgraded in useConsentManager
        disable_session_recording: true,
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: '[data-ph-mask]',
          blockSelector: '.ph-no-capture, [data-ph-block]',
        },
        // Share identity across subdomains only in production
        ...(cookieDomain && { cookie_domain: cookieDomain }),
        loaded: ph => {
          if (import.meta.dev) {
            ph.debug()
            console.log('PostHog initialized successfully')
          }
        },
      })
      instance = posthog

      // Attach Google Ads params as super properties (in-memory, no person profile)
      const params = new URLSearchParams(window.location.search)
      const adParams: Record<string, string> = {}
      const adParamMap: Record<string, string> = {
        gclid: 'gclid',
        hsa_kw: 'hsa_keyword',
        hsa_cam: 'hsa_campaign_id',
        hsa_grp: 'hsa_adgroup_id',
        hsa_ad: 'hsa_ad_id',
      }
      for (const [param, propName] of Object.entries(adParamMap)) {
        const value = params.get(param)
        if (value) adParams[propName] = value
      }
      if (Object.keys(adParams).length > 0) {
        posthog.register(adParams)
      }
    } catch (e) {
      console.error('PostHog failed to initialize — using mock. Reason:', e)
      instance = mockPosthog
    }
  }

  if (typeof window !== 'undefined') {
    window.__posthog_instance = instance
  }

  // Provide a getter that always returns a safe instance (real or mock)
  return {
    provide: {
      posthog: () => instance,
    },
  }
})
