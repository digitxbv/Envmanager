// Billing lock middleware — redirects locked workspaces to billing page.
// Runs after auth.ts (alphabetically later, so Nuxt loads auth first).

const BILLING_ALLOWLIST = [
  '/dashboard/settings/billing',
  '/dashboard/billing'
]

export default defineNuxtRouteMiddleware(async (to) => {
  // Only relevant for dashboard routes
  if (!to.path.startsWith('/dashboard')) return

  // Self-hosted instances are never billing-locked — skip the fetch + check entirely.
  if (useRuntimeConfig().public.selfHosted) return

  // Allow billing management routes through unconditionally
  if (BILLING_ALLOWLIST.some(path => to.path.startsWith(path))) return

  // Skip on server — mirrors auth.ts which uses client.auth.getUser() (a network call)
  // and therefore implicitly only matters client-side for navigation guards.
  // The overlay in dashboard.vue handles the visual lock on first render.
  if (import.meta.server) return

  const billingStore = useBillingStore()
  const organizationStore = useOrganizationStore()

  // No org selected — fail open (don't lock; user may be mid-onboarding)
  if (!organizationStore.selectedOrganizationId) return

  // If subscription isn't loaded yet, attempt to fetch it
  if (!billingStore.subscription) {
    try {
      const { fetchSubscription } = useBilling()
      await fetchSubscription()
    } catch {
      // Fail open — don't block navigation on a fetch error
      return
    }
  }

  if (billingStore.isLocked) {
    return navigateTo('/dashboard/settings/billing')
  }
})
