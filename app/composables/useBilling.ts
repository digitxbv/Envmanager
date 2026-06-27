// =====================================================
// Billing Composable
// =====================================================
// Core composable for managing subscription operations and billing
// State is now managed by useBillingStore (Pinia)

import type {
  SubscriptionWithPlan,
  PlanId,
  StripeCheckoutOptions,
  StripePortalOptions,
  UseBillingReturn
} from '~/types/billing.types'

export const useBilling = (): UseBillingReturn => {
  const client = useSupabaseClient()
  const user = useSupabaseUser()
  const organizationStore = useOrganizationStore()
  const billingStore = useBillingStore()
  const { $toast } = useNuxtApp()

  // =====================================================
  // Methods
  // =====================================================

  /**
   * Fetch subscription data for an organization
   */
  const fetchSubscription = async (organizationId?: string) => {
    const orgId = organizationId || organizationStore.selectedOrganizationId

    if (!orgId) {
      console.warn('[useBilling] No organization selected')
      return
    }

    billingStore.setLoading(true)
    billingStore.clearError()

    try {
      const { data, error: fetchError } = await client
        .from('organization_subscriptions')
        .select(`
          *,
          plan:subscription_plans!plan_id(*)
        `)
        .eq('organization_id', orgId)
        .single()

      if (fetchError) {
        // If no subscription exists, it should have been created by the trigger
        // This is an unexpected state
        if (fetchError.code === 'PGRST116') {
          console.error('[useBilling] No subscription found for organization. This should not happen.')
          // Try to create one as a fallback
          await createTrialSubscription(orgId)
          return
        }
        throw fetchError
      }

      billingStore.setSubscription(data as unknown as SubscriptionWithPlan)
    } catch (err) {
      billingStore.setError(err as Error)
      console.error('[useBilling] Failed to fetch subscription:', err)
      $toast.error('Failed to load subscription information')
    } finally {
      billingStore.setLoading(false)
    }
  }

  /**
   * Create a trial subscription (fallback, should not be needed with trigger)
   */
  const createTrialSubscription = async (organizationId: string) => {
    try {
      const { data, error: insertError } = await client
        .from('organization_subscriptions')
        .insert({
          organization_id: organizationId,
          plan_id: 'pro_monthly',
          status: 'trialing',
          trial_start_date: new Date().toISOString(),
          trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .single()

      if (insertError) throw insertError

      billingStore.setSubscription(data as unknown as SubscriptionWithPlan)

      // Log billing event
      await logBillingEvent({
        organization_id: organizationId,
        event_type: 'subscription_created',
        to_plan_id: 'pro_monthly',
        details: { source: 'fallback_create', trial_days: 14 }
      })
    } catch (err) {
      console.error('[useBilling] Failed to create trial subscription:', err)
      throw err
    }
  }

  /**
   * Start Stripe Checkout for plan upgrade
   */
  const startCheckout = async (planId: PlanId) => {
    const orgId = organizationStore.selectedOrganizationId

    if (!orgId) {
      $toast.error('No organization selected')
      throw new Error('No organization selected')
    }

    billingStore.setLoading(true)
    billingStore.clearError()

    try {
      const options: StripeCheckoutOptions = {
        organizationId: orgId,
        planId,
        successUrl: `${window.location.origin}/dashboard/settings?tab=billing&success=true`,
        cancelUrl: `${window.location.origin}/dashboard/settings?tab=billing&canceled=true`
      }

      const { data, error: checkoutError } = await client.functions.invoke('stripe-checkout', {
        body: options
      })

      if (checkoutError) throw checkoutError

      if (!data?.url) {
        throw new Error('No checkout URL returned')
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (err) {
      billingStore.setError(err as Error)
      console.error('[useBilling] Checkout failed:', err)
      $toast.error('Failed to start checkout. Please try again.')
      throw err
    } finally {
      billingStore.setLoading(false)
    }
  }

  /**
   * Open Stripe Customer Portal
   */
  const openCustomerPortal = async () => {
    const orgId = organizationStore.selectedOrganizationId
    const subscription = billingStore.subscription as SubscriptionWithPlan | null

    if (!orgId) {
      $toast.error('No organization selected')
      throw new Error('No organization selected')
    }

    if (!subscription?.stripe_customer_id) {
      $toast.error('No billing account found')
      throw new Error('No Stripe customer ID')
    }

    billingStore.setLoading(true)
    billingStore.clearError()

    try {
      const options: StripePortalOptions = {
        organizationId: orgId,
        returnUrl: `${window.location.origin}/dashboard/settings?tab=billing`
      }

      const { data, error: portalError } = await client.functions.invoke('stripe-portal', {
        body: options
      })

      if (portalError) throw portalError

      if (!data?.url) {
        throw new Error('No portal URL returned')
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url
    } catch (err) {
      billingStore.setError(err as Error)
      console.error('[useBilling] Portal failed:', err)
      $toast.error('Failed to open billing portal. Please try again.')
      throw err
    } finally {
      billingStore.setLoading(false)
    }
  }

  /**
   * Start 14-day Pro trial (manual trigger, not needed with auto-trial on signup)
   */
  const startTrial = async () => {
    const orgId = organizationStore.selectedOrganizationId

    if (!orgId) {
      $toast.error('No organization selected')
      throw new Error('No organization selected')
    }

    billingStore.setLoading(true)
    billingStore.clearError()

    try {
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 14)

      const { data, error: updateError } = await client
        .from('organization_subscriptions')
        .update({
          plan_id: 'pro_monthly',
          status: 'trialing',
          trial_start_date: new Date().toISOString(),
          trial_end_date: trialEnd.toISOString()
        })
        .eq('organization_id', orgId)
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .single()

      if (updateError) throw updateError

      billingStore.setSubscription(data as unknown as SubscriptionWithPlan)

      await logBillingEvent({
        organization_id: orgId,
        event_type: 'trial_started',
        to_plan_id: 'pro_monthly',
        details: { trial_days: 14, manual_trigger: true }
      })

      $toast.success('14-day Pro trial started!')
    } catch (err) {
      billingStore.setError(err as Error)
      console.error('[useBilling] Trial start failed:', err)
      $toast.error('Failed to start trial. Please try again.')
      throw err
    } finally {
      billingStore.setLoading(false)
    }
  }

  /**
   * Log a billing event (fire-and-forget)
   */
  const logBillingEvent = async (event: {
    organization_id: string
    event_type: string
    from_plan_id?: string
    to_plan_id?: string
    details?: Record<string, any>
  }) => {
    try {
      await client.from('billing_events').insert({
        ...event,
        triggered_by: user.value?.id || null
      })
    } catch (err) {
      // Don't throw - billing events are fire-and-forget
      console.error('[useBilling] Failed to log billing event:', err)
    }
  }

  // =====================================================
  // Return Public API
  // =====================================================

  const subscriptionState = computed(() => billingStore.subscription as SubscriptionWithPlan | null)

  const currentPlanId = computed<PlanId>(() => {
    const planId = subscriptionState.value?.plan_id
    return planId === 'pro_monthly' || planId === 'pro_annual' ? planId : 'pro_monthly'
  })

  const isFreePlan = computed(() => currentPlanId.value === 'free')
  const isProPlan = computed(() => currentPlanId.value === 'pro_monthly' || currentPlanId.value === 'pro_annual')
  const isLocked = computed(() => billingStore.isLocked as boolean)
  const isTrialExpired = computed(() => {
    const sub = subscriptionState.value
    if (sub?.status !== 'trialing' || !sub.trial_end_date) return false
    return new Date(sub.trial_end_date) < new Date()
  })
  const isTrialing = computed(() => {
    return subscriptionState.value?.status === 'trialing' && !isTrialExpired.value
  })
  const isActive = computed(() => {
    const status = subscriptionState.value?.status
    if (status === 'active' || status === 'past_due') return true
    if (status === 'trialing') return !isTrialExpired.value
    return false
  })
  const trialDaysRemaining = computed(() => {
    const trialEndDate = subscriptionState.value?.trial_end_date
    if (!trialEndDate || subscriptionState.value?.status !== 'trialing') {
      return 0
    }

    const endDate = new Date(trialEndDate)
    const now = new Date()
    const diffMs = endDate.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  })

  const billingApi: UseBillingReturn = {
    // State (from store)
    subscription: subscriptionState,
    loading: computed(() => billingStore.loading as boolean),
    error: computed(() => billingStore.error as Error | null),

    // Computed (from store)
    currentPlanId,
    isFreePlan,
    isProPlan,
    isTrialing,
    isTrialExpired,
    isLocked,
    isActive,
    trialDaysRemaining,

    // Methods
    fetchSubscription,
    startCheckout,
    openCustomerPortal,
    startTrial
  }

  return billingApi
}
