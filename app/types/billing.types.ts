// =====================================================
// Billing Type Definitions
// =====================================================
// Comprehensive TypeScript types for the billing system

import type { Database } from './database.types'

// =====================================================
// Database Row Types
// =====================================================

export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']
export type OrganizationSubscription = Database['public']['Tables']['organization_subscriptions']['Row']
export type BillingEvent = Database['public']['Tables']['billing_events']['Row']
export type OrganizationUsage = Database['public']['Tables']['organization_usage']['Row']

// =====================================================
// Plan Types
// =====================================================

export type PlanId = 'free' | 'pro_monthly' | 'pro_annual'

export interface PlanLimits {
  projects: number // -1 = unlimited
  environments_per_project: number // -1 = unlimited
  variables_per_environment: number // -1 = unlimited
  team_members: number
  integrations: number // -1 = unlimited
  proxy_functions: number // -1 = unlimited
  audit_log_retention_days: number
}

export type PlanFeature =
  | 'basic_audit_logs'
  | 'unlimited_everything'
  | 'advanced_audit_logs'
  | 'priority_support'
  | 'sso'
  | 'annual_discount'

// =====================================================
// Subscription Types
// =====================================================

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'paused'

export interface SubscriptionWithPlan extends OrganizationSubscription {
  plan: SubscriptionPlan
}

// =====================================================
// Billing Event Types
// =====================================================

export type BillingEventType =
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'subscription_renewed'
  | 'trial_started'
  | 'trial_ended'
  | 'trial_converted'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'plan_upgraded'
  | 'plan_downgraded'
  | 'limit_reached'
  | 'limit_exceeded_blocked'

// =====================================================
// Usage Types
// =====================================================

export interface CurrentUsage {
  projects: number
  environments: number
  variables: number
  team_members: number
  integrations: number
  proxy_functions: number
}

export interface ProxyInvocationUsage {
  used: number
  included: number
  overage: number
  percentUsed: number
  period: string
  perProxy: Array<{ proxy_function_id: string; name: string; call_count: number }>
}

export type LimitType = keyof Omit<PlanLimits, 'audit_log_retention_days'>

// =====================================================
// Limit Check Result
// =====================================================

export interface LimitCheckResult {
  allowed: boolean
  limit: number // -1 = unlimited
  current: number
  remaining: number // -1 = unlimited
  limitType: LimitType
  isUnlimited: boolean
}

// =====================================================
// Stripe Integration Types
// =====================================================

export interface StripeCheckoutOptions {
  organizationId: string
  planId: PlanId
  successUrl?: string
  cancelUrl?: string
  customerEmail?: string
}

export interface StripePortalOptions {
  organizationId: string
  returnUrl?: string
}

export interface StripeCheckoutResponse {
  url: string
}

export interface StripePortalResponse {
  url: string
}

// =====================================================
// Composable Return Types
// =====================================================

export interface UseBillingReturn {
  // State
  subscription: Readonly<Ref<SubscriptionWithPlan | null>>
  loading: Readonly<Ref<boolean>>
  error: Readonly<Ref<Error | null>>

  // Computed
  currentPlanId: ComputedRef<PlanId>
  isFreePlan: ComputedRef<boolean>
  isProPlan: ComputedRef<boolean>
  isTrialing: ComputedRef<boolean>
  isTrialExpired: ComputedRef<boolean>
  isLocked: ComputedRef<boolean>
  isActive: ComputedRef<boolean>
  trialDaysRemaining: ComputedRef<number>

  // Methods
  fetchSubscription: (organizationId?: string) => Promise<void>
  startCheckout: (planId: PlanId) => Promise<void>
  openCustomerPortal: () => Promise<void>
  startTrial: () => Promise<void>
}

export interface UseLimitsReturn {
  getCurrentUsage: (organizationId?: string) => Promise<CurrentUsage>
  getProxyInvocationUsage: (organizationId?: string) => Promise<ProxyInvocationUsage>
  checkLimit: (limitType: LimitType, increment?: number) => Promise<LimitCheckResult>
  checkEnvironmentVariableLimit: (environmentId: string, increment?: number) => Promise<LimitCheckResult>
  checkProjectEnvironmentLimit: (projectId: string, increment?: number) => Promise<LimitCheckResult>
  enforceLimit: (limitType: LimitType, increment?: number) => Promise<boolean>
}

export interface UsePlansReturn {
  plans: Readonly<Ref<readonly SubscriptionPlan[]>>
  loading: Readonly<Ref<boolean>>
  error: Readonly<Ref<Error | null>>
  fetchPlans: () => Promise<void>
  getPlanById: (planId: string) => SubscriptionPlan | undefined
  formatPrice: (priceCents: number, interval?: string | null) => string
}

// =====================================================
// Component Props
// =====================================================

export interface BillingCurrentPlanProps {
  subscription: SubscriptionWithPlan | null
}

export interface BillingTrialBannerProps {
  daysRemaining: number
}

export interface BillingUsageCardProps {
  usage: CurrentUsage | null
  limits: PlanLimits | null
}

export interface UsageCardProps {
  title: string
  current: number
  limit: number
  icon: string
}

export interface LimitReachedModalProps {
  limitType: LimitType
  current: number
  limit: number
}

export interface BillingUpgradeModalProps {
  open: boolean
  plans: SubscriptionPlan[]
  currentPlanId: PlanId
}

// =====================================================
// Event Payloads
// =====================================================

export interface LimitReachedEvent {
  detail: LimitCheckResult
}
