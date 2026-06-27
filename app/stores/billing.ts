import { defineStore } from 'pinia'
import type { SubscriptionWithPlan, PlanId } from '~/types/billing.types'
import { isWorkspaceLocked } from '~/utils/selfHosted'

export const useBillingStore = defineStore('billing', {
  state: () => ({
    subscription: null as unknown,
    loading: false,
    error: null as Error | null
  }),

  getters: {
    currentPlanId(): PlanId {
      const subscription = this.subscription as SubscriptionWithPlan | null
      return (subscription?.plan_id as PlanId) || 'pro_monthly'
    },

    isFreePlan(): boolean {
      return this.currentPlanId === 'free'
    },

    isProPlan(): boolean {
      return this.currentPlanId.startsWith('pro')
    },

    isLocked(): boolean {
      const selfHosted = useRuntimeConfig().public.selfHosted as boolean
      const subscription = this.subscription as SubscriptionWithPlan | null
      const locked = subscription?.status === 'paused' || (this.isTrialExpired as boolean)
      return isWorkspaceLocked(selfHosted, locked)
    },

    isTrialExpired: (state): boolean => {
      const subscription = state.subscription as SubscriptionWithPlan | null
      if (subscription?.status !== 'trialing') return false
      if (!subscription.trial_end_date) return false
      return new Date(subscription.trial_end_date) < new Date()
    },

    isTrialing: (state): boolean => {
      const subscription = state.subscription as SubscriptionWithPlan | null
      if (subscription?.status !== 'trialing') return false
      // Not trialing if trial has expired
      if (subscription.trial_end_date && new Date(subscription.trial_end_date) < new Date()) return false
      return true
    },

    isActive: (state): boolean => {
      const subscription = state.subscription as SubscriptionWithPlan | null
      const status = subscription?.status
      if (status === 'active' || status === 'past_due') return true
      // Trialing is only active if trial hasn't expired
      if (status === 'trialing') {
        if (subscription?.trial_end_date && new Date(subscription.trial_end_date) < new Date()) return false
        return true
      }
      return false
    },

    trialDaysRemaining: (state): number => {
      const subscription = state.subscription as SubscriptionWithPlan | null
      if (!subscription?.trial_end_date) return 0

      const now = new Date()
      const trialEnd = new Date(subscription.trial_end_date)
      const diff = trialEnd.getTime() - now.getTime()
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

      return Math.max(0, days)
    }
  },

  actions: {
    setSubscription(subscription: SubscriptionWithPlan | null) {
      this.subscription = subscription
    },

    setLoading(loading: boolean) {
      this.loading = loading
    },

    setError(error: Error | null) {
      this.error = error
    },

    clearError() {
      this.error = null
    }
  }
})
