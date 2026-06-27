// =====================================================
// Plans Composable
// =====================================================
// Fetch and manage subscription plan data

import type { SubscriptionPlan, UsePlansReturn } from '~/types/billing.types'

export const usePlans = (): UsePlansReturn => {
  const client = useSupabaseClient()

  // =====================================================
  // Reactive State
  // =====================================================

  const plans = ref<SubscriptionPlan[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // =====================================================
  // Methods
  // =====================================================

  /**
   * Fetch all active subscription plans
   */
  const fetchPlans = async () => {
    loading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await client
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (fetchError) throw fetchError

      plans.value = data || []
    } catch (err) {
      error.value = err as Error
      console.error('[usePlans] Failed to fetch plans:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Get a specific plan by ID
   */
  const getPlanById = (planId: string): SubscriptionPlan | undefined => {
    const allPlans = plans.value as unknown as SubscriptionPlan[]
    for (const plan of allPlans) {
      if (plan.id === planId) {
        return plan
      }
    }

    return undefined
  }

  /**
   * Format price for display
   */
  const formatPrice = (priceCents: number, interval?: string | null): string => {
    if (priceCents === 0) return 'Free'

    const dollars = priceCents / 100
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(dollars)

    if (!interval) return formatted

    return `${formatted}/${interval}`
  }

  // =====================================================
  // Return Public API
  // =====================================================

  return {
    plans: readonly(plans),
    loading: readonly(loading),
    error: readonly(error),
    fetchPlans,
    getPlanById,
    formatPrice
  } as unknown as UsePlansReturn
}
