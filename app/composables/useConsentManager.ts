declare global {
  interface Window {
    Cookiebot?: { consent?: { stamp?: string; statistics?: boolean; marketing?: boolean } }
    dataLayer?: Record<string, unknown>[]
  }
}

/**
 * Global Cookiebot + PostHog consent manager.
 * Call once from app.vue — applies to ALL layouts (default, landing, auth, dashboard).
 */
export const useConsentManager = () => {
  const { $posthog } = useNuxtApp()

  const applyConsent = (consent: { statistics?: boolean; marketing?: boolean }) => {
    const dl = (window.dataLayer = window.dataLayer || [])
    const ph = $posthog()

    if (consent.statistics) {
      // Upgrade from memory-only to persistent tracking + enable session recording
      const cookieDomain = window.location.hostname.endsWith('envmanager.com') ? '.envmanager.com' : undefined
      ph.set_config({
        persistence: 'localStorage+cookie',
        ...(cookieDomain && { cookie_domain: cookieDomain }),
      })
      ph.opt_in_capturing()
      ph.startSessionRecording()

      // Capture Google Ads params for attribution (only after consent)
      const params = new URLSearchParams(window.location.search)
      const adParamMap: Record<string, string> = {
        gclid: 'gclid',
        hsa_kw: 'hsa_keyword',
        hsa_cam: 'hsa_campaign_id',
        hsa_grp: 'hsa_adgroup_id',
        hsa_ad: 'hsa_ad_id',
      }
      const adParams: Record<string, string> = {}
      for (const [param, propName] of Object.entries(adParamMap)) {
        const value = params.get(param)
        if (value) adParams[propName] = value
      }
      if (Object.keys(adParams).length > 0) {
        ph.register(adParams)
        ph.setPersonProperties({}, adParams)
      }

      dl.push({ event: 'consent_update', analytics_storage: 'granted' })
    } else {
      dl.push({ event: 'consent_update', analytics_storage: 'denied' })
    }

    if (consent.marketing) {
      dl.push({ event: 'consent_update', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' })
    } else {
      dl.push({ event: 'consent_update', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
    }

    dl.push({ event: 'consent_update', functionality_storage: 'granted', security_storage: 'granted' })
  }

  const onCookiebotAccept = () => {
    if (window.Cookiebot?.consent) {
      applyConsent(window.Cookiebot.consent)
    }
  }

  const onCookiebotDecline = () => {
    applyConsent({ statistics: false, marketing: false })
  }

  const init = () => {
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname) || window.location.hostname.endsWith('.local')

    // Never capture PostHog events from local environments
    if (import.meta.dev || isLocalHost) {
      $posthog().opt_out_capturing()
      return
    }

    window.addEventListener('CookiebotOnAccept', onCookiebotAccept)
    window.addEventListener('CookiebotOnDecline', onCookiebotDecline)

    // Returning visitor: consent already resolved before mount
    if (window.Cookiebot?.consent?.stamp && window.Cookiebot.consent.stamp !== '0') {
      applyConsent(window.Cookiebot.consent)
    }
  }

  const cleanup = () => {
    window.removeEventListener('CookiebotOnAccept', onCookiebotAccept)
    window.removeEventListener('CookiebotOnDecline', onCookiebotDecline)
  }

  return { init, cleanup }
}
