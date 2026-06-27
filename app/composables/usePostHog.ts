const createNoopPostHogApi = () => ({
  posthog: null as null,
  trackPageView: (_path?: string) => {},
  track: (_eventName: string, _properties?: Record<string, unknown>) => {},
  register: (_properties: Record<string, unknown>) => {},
  identify: (_userId: string, _properties?: Record<string, unknown>) => {},
  setUserProperties: (_properties: Record<string, unknown>) => {},
  isFeatureEnabled: (_flagKey: string) => false,
  getFeatureFlag: (_flagKey: string, options?: { send_event?: boolean }) => options,
  onFeatureFlags: (_callback: (flags: string[]) => void) => {},
  getExperiment: (_experimentKey: string, options?: { send_event?: boolean }) => options,
  getSurveys: () => [] as unknown[],
  getActiveMatchingSurveys: () => [] as unknown[],
  reset: () => {},
  group: (_groupType: string, _groupKey: string, _properties?: Record<string, unknown>) => {},
  alias: (_alias: string) => {},
})

export const usePostHog = () => {
  if (import.meta.server) {
    return createNoopPostHogApi()
  }

  const { $posthog } = useNuxtApp()
  if (typeof $posthog !== 'function') {
    return createNoopPostHogApi()
  }

  const posthog = $posthog()
  if (!posthog) {
    return createNoopPostHogApi()
  }

  // Track page views
  const trackPageView = (path?: string) => {
    // Never include the URL #fragment — on /share/<id>#<key> it holds the secret
    // decryption key, which must never reach analytics.
    const raw = path || `${window.location.pathname}${window.location.search}`
    const currentPath = raw.replace(/#.*$/, '')
    if (!currentPath) {
      return
    }

    posthog.capture('$pageview', {
      $current_url: currentPath,
      path: currentPath,
    })
  }

  // Track custom events
  const track = (eventName: string, properties?: Record<string, unknown>) => {
    posthog.capture(eventName, properties)
  }

  // Register persistent super properties for all future events
  const register = (properties: Record<string, unknown>) => {
    posthog.register?.(properties)
  }

  // Identify users
  const identify = (userId: string, properties?: Record<string, unknown>) => {
    posthog.identify(userId, properties)
  }

  // Set user properties
  const setUserProperties = (properties: Record<string, unknown>) => {
    posthog.people.set(properties)
  }

  // Feature flags
  const isFeatureEnabled = (flagKey: string): boolean => {
    return Boolean(posthog.isFeatureEnabled(flagKey))
  }

  const getFeatureFlag = (flagKey: string, options?: { send_event?: boolean }): unknown => {
    return posthog.getFeatureFlag(flagKey, options)
  }

  const onFeatureFlags = (callback: (flags: string[]) => void) => {
    posthog.onFeatureFlags(callback)
  }

  // Experiments
  const getExperiment = (experimentKey: string, options?: { send_event?: boolean }): unknown => {
    return posthog.getFeatureFlag(experimentKey, options)
  }

  // Surveys
  const getSurveys = () => {
    return [] as unknown[]
  }

  const getActiveMatchingSurveys = () => {
    return [] as unknown[]
  }

  // Reset user (for logout)
  const reset = () => {
    posthog.reset()
  }

  // Group analytics (for B2B)
  const group = (groupType: string, groupKey: string, properties?: Record<string, unknown>) => {
    posthog.group(groupType, groupKey, properties)
  }

  // Alias (for connecting anonymous user to identified user)
  const alias = (alias: string) => {
    posthog.alias(alias)
  }

  return {
    posthog,
    trackPageView,
    track,
    register,
    identify,
    setUserProperties,
    isFeatureEnabled,
    getFeatureFlag,
    onFeatureFlags,
    getExperiment,
    getSurveys,
    getActiveMatchingSurveys,
    reset,
    group,
    alias,
  }
}
