// =====================================================
// Limits Composable
// =====================================================
// Centralized limit checking and enforcement for billing tiers

import type {
  LimitCheckResult,
  CurrentUsage,
  ProxyInvocationUsage,
  LimitType,
  UseLimitsReturn
} from '~/types/billing.types'
import { effectiveLimits } from '~/utils/selfHosted'

export const useLimits = (): UseLimitsReturn => {
  const client = useSupabaseClient()
  const billingStore = useBillingStore()
  const organizationStore = useOrganizationStore()
  const { fetchSubscription } = useBilling()

  // Helper to ensure subscription is loaded
  const ensureSubscription = async () => {
    if (!billingStore.subscription) {
      await fetchSubscription()
    }
  }

  // Get effective limits from the loaded subscription plan.
  // Self-hosted instances are always unlimited regardless of plan.
  const getEffectiveLimits = async (): Promise<Record<string, number>> => {
    const selfHosted = useRuntimeConfig().public.selfHosted as boolean
    const subscription = billingStore.subscription as unknown as { plan: { limits: Record<string, number> } } | null
    return effectiveLimits(selfHosted, subscription?.plan?.limits ?? {})
  }

  // =====================================================
  // Get Current Usage
  // =====================================================

  /**
   * Get current resource usage for an organization
   */
  const getCurrentUsage = async (organizationId?: string): Promise<CurrentUsage> => {
    const orgId = organizationId || organizationStore.selectedOrganizationId

    if (!orgId) {
      throw new Error('No organization selected')
    }

    try {
      // Execute all count queries in parallel for performance
      const [projectsResult, envsResult, varsResult, membersResult, integrationsResult, proxyFunctionsResult] = await Promise.all([
        client
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId),

        client
          .from('environments')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId),

        client
          .from('variables')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId),

        client
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId),

        client
          .from('platform_integrations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('disconnected_at', null),

        client
          .from('proxy_functions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
      ])

      return {
        projects: projectsResult.count || 0,
        environments: envsResult.count || 0,
        variables: varsResult.count || 0,
        team_members: membersResult.count || 0,
        integrations: integrationsResult.count || 0,
        proxy_functions: proxyFunctionsResult.count || 0
      }
    } catch (err) {
      console.error('[useLimits] Failed to get current usage:', err)
      throw err
    }
  }

  // =====================================================
  // Proxy Invocation Usage
  // =====================================================

  /**
   * Get proxy invocation usage for the current billing month.
   * Uses the get_proxy_overage RPC which reads from proxy_invocations aggregate table.
   */
  const getProxyInvocationUsage = async (organizationId?: string): Promise<ProxyInvocationUsage> => {
    const orgId = organizationId || organizationStore.selectedOrganizationId

    if (!orgId) {
      throw new Error('No organization selected')
    }

    await ensureSubscription()

    const effectiveLimits = await getEffectiveLimits()
    const included = effectiveLimits.proxy_invocations_monthly ?? 500
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const [overageResult, perProxyResult] = await Promise.all([
      client.rpc('get_proxy_overage', {
        p_organization_id: orgId,
        p_period: period,
        p_included_limit: included
      }),
      client
        .from('proxy_invocations')
        .select('proxy_function_id, call_count, proxy_functions(name)')
        .eq('organization_id', orgId)
        .eq('period', period)
        .order('call_count', { ascending: false })
        .limit(5)
    ])

    if (overageResult.error) {
      console.error('[useLimits] get_proxy_overage failed:', overageResult.error)
      throw overageResult.error
    }

    const data = overageResult.data as { total_calls: number; included_limit: number; overage: number; is_over: boolean }
    const used = data.total_calls ?? 0
    const overage = data.overage ?? 0
    const percentUsed = included > 0 ? (used / included) * 100 : 0

    type InvocationRow = { proxy_function_id: string; call_count: number; proxy_functions: { name: string } | null }
    const rows = (perProxyResult.data ?? []) as InvocationRow[]
    const perProxy = rows.map((r) => ({
      proxy_function_id: r.proxy_function_id,
      name: r.proxy_functions?.name ?? r.proxy_function_id,
      call_count: r.call_count
    }))

    return { used, included, overage, percentUsed, period, perProxy }
  }

  // =====================================================
  // Limit Checking
  // =====================================================

  /**
   * Check if creating a resource would exceed limits
   */
  const checkLimit = async (
    limitType: LimitType,
    increment: number = 1
  ): Promise<LimitCheckResult> => {
    const orgId = organizationStore.selectedOrganizationId

    if (!orgId) {
      throw new Error('No organization selected')
    }

    await ensureSubscription()

    if (!billingStore.subscription) {
      throw new Error('Failed to load subscription')
    }

    // Get effective limits from the subscription plan
    const limits = await getEffectiveLimits()
    const limit = limits[limitType] ?? -1

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        limit: -1,
        current: 0,
        remaining: -1,
        limitType,
        isUnlimited: true
      }
    }

    // Get current usage
    const usage = await getCurrentUsage(orgId)

    // Map limitType to usage key
    let current = 0
    switch (limitType) {
      case 'projects':
        current = usage.projects
        break
      case 'team_members':
        current = usage.team_members
        break
      case 'integrations':
        current = usage.integrations
        break
      case 'proxy_functions':
        current = usage.proxy_functions
        break
      case 'environments_per_project':
        // This requires project context - handled separately
        current = 0
        break
      case 'variables_per_environment':
        // This requires environment context - handled separately
        current = 0
        break
    }

    const newTotal = current + increment
    const allowed = newTotal <= limit

    return {
      allowed,
      limit,
      current,
      remaining: Math.max(0, limit - current),
      limitType,
      isUnlimited: false
    }
  }

  /**
   * Check variable limit for a specific environment
   */
  const checkEnvironmentVariableLimit = async (
    environmentId: string,
    increment: number = 1
  ): Promise<LimitCheckResult> => {
    await ensureSubscription()

    if (!billingStore.subscription) {
      throw new Error('Failed to load subscription')
    }

    const limits = await getEffectiveLimits()
    const limit = limits.variables_per_environment ?? -1

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        limit: -1,
        current: 0,
        remaining: -1,
        limitType: 'variables_per_environment',
        isUnlimited: true
      }
    }

    // Get current variable count for this environment
    const { count, error } = await client
      .from('variables')
      .select('id', { count: 'exact', head: true })
      .eq('environment_id', environmentId)

    if (error) {
      console.error('[useLimits] Failed to count variables:', error)
      throw error
    }

    const current = count || 0
    const newTotal = current + increment
    const allowed = newTotal <= limit

    return {
      allowed,
      limit,
      current,
      remaining: Math.max(0, limit - current),
      limitType: 'variables_per_environment',
      isUnlimited: false
    }
  }

  /**
   * Check environment limit for a specific project
   */
  const checkProjectEnvironmentLimit = async (
    projectId: string,
    increment: number = 1
  ): Promise<LimitCheckResult> => {
    await ensureSubscription()

    if (!billingStore.subscription) {
      throw new Error('Failed to load subscription')
    }

    const limits = await getEffectiveLimits()
    const limit = limits.environments_per_project ?? -1

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        limit: -1,
        current: 0,
        remaining: -1,
        limitType: 'environments_per_project',
        isUnlimited: true
      }
    }

    // Get current environment count for this project
    const { count, error } = await client
      .from('environments')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)

    if (error) {
      console.error('[useLimits] Failed to count environments:', error)
      throw error
    }

    const current = count || 0
    const newTotal = current + increment
    const allowed = newTotal <= limit

    return {
      allowed,
      limit,
      current,
      remaining: Math.max(0, limit - current),
      limitType: 'environments_per_project',
      isUnlimited: false
    }
  }

  // =====================================================
  // Enforce Limits with UI
  // =====================================================

  /**
   * Enforce a limit and automatically show upgrade modal if exceeded
   * @returns true if allowed, false if blocked
   */
  const enforceLimit = async (
    limitType: LimitType,
    increment: number = 1
  ): Promise<boolean> => {
    let result: LimitCheckResult

    // Check the appropriate limit based on type
    if (limitType === 'variables_per_environment' || limitType === 'environments_per_project') {
      // These require context, so they should use specific check functions
      console.warn('[useLimits] enforceLimit() called with context-specific limitType. Use checkEnvironmentVariableLimit() or checkProjectEnvironmentLimit() instead.')
      return false
    }

    result = await checkLimit(limitType, increment)

    if (!result.allowed) {
      // Trigger limit reached event - LimitReachedModal component will listen
      const event = new CustomEvent('billing:limit-reached', {
        detail: result
      })
      window.dispatchEvent(event)

      return false
    }

    return true
  }

  // =====================================================
  // Return Public API
  // =====================================================

  return {
    getCurrentUsage,
    getProxyInvocationUsage,
    checkLimit,
    checkEnvironmentVariableLimit,
    checkProjectEnvironmentLimit,
    enforceLimit
  }
}
