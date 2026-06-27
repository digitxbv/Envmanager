export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const { captureCampaignParams } = useTrackingParams()
  captureCampaignParams()

  const { trackPageView } = usePostHog()
  // Use path only (NOT fullPath) so the #fragment — which holds the secret decryption
  // key on /share/<id> — is never sent to analytics.
  trackPageView(to.path)
})
