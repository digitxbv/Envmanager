import type { Database, Json } from '~/types/database.types'

type OrganizationRow = Database['public']['Tables']['organizations']['Row']
type OrganizationSubscriptionRow = Database['public']['Tables']['organization_subscriptions']['Row']
type BillingEventRow = Database['public']['Tables']['billing_events']['Row']

export interface PlatformPlanDistributionItem {
  plan_id: string
  status: string
  count: number
}

export interface PlatformStats {
  total_organizations: number
  total_users: number
  total_projects: number
  total_environments: number
  total_variables: number
  plan_distribution: PlatformPlanDistributionItem[]
}

export interface PlatformOrganizationCounts {
  projects_count: number
  environments_count: number
  variables_count: number
}

export interface PlatformOrganizationSummary {
  id: string
  name: string
  created_at: string
  owner_email: string | null
  member_count: number
  integration_count: number
  env_var_count: number
  last_sign_in_at: string | null
  subscription: Pick<
    OrganizationSubscriptionRow,
    'plan_id' | 'status' | 'trial_end_date' | 'current_period_end' | 'updated_at'
  > | null
}

export interface PlatformOrganizationMember {
  id: string
  user_id: string
  email: string
  role: string
  created_at: string
  environment_access_count: number
}

export interface PlatformOrganizationIntegration {
  platform: string
  name: string
  connected_at: string
  token_valid: boolean | null
}

export interface PlatformOrganizationGitHubInstallation {
  account_login: string
  account_type: string
  installed_at: string | null
}

export interface PlatformOrganizationDetail {
  organization: OrganizationRow
  owner_email: string | null
  member_count: number
  stats: PlatformOrganizationCounts
  members: PlatformOrganizationMember[]
  subscription: OrganizationSubscriptionRow | null
  billing_events: BillingEventRow[]
  integrations: PlatformOrganizationIntegration[]
  github_installations: PlatformOrganizationGitHubInstallation[]
}

export interface PlatformSubscriptionUpdate {
  plan_id?: string
  status?: string
  trial_end_date?: string | null
  trial_start_date?: string | null
  current_period_end?: string | null
  current_period_start?: string | null
  cancel_at_period_end?: boolean
  canceled_at?: string | null
}

const PLATFORM_ADMIN_CACHE_TTL_MS = 60_000

export const usePlatformAdmin = () => {
  const client = useSupabaseClient()
  const user = useSupabaseUser()
  const { $toast } = useNuxtApp()
  const { handleError } = useSupabaseErrorHandler()

  const platformAdminCache = useState<boolean | null>('platform-admin:is-admin', () => null)
  const platformAdminCheckedAt = useState<number>('platform-admin:checked-at', () => 0)

  const parsePlatformStats = (input: Json | null): PlatformStats => {
    const defaults: PlatformStats = {
      total_organizations: 0,
      total_users: 0,
      total_projects: 0,
      total_environments: 0,
      total_variables: 0,
      plan_distribution: []
    }

    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return defaults
    }

    const raw = input as Record<string, unknown>

    const distribution = Array.isArray(raw.plan_distribution)
      ? raw.plan_distribution
          .map((item): PlatformPlanDistributionItem | null => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
              return null
            }

            const row = item as Record<string, unknown>
            const planId = typeof row.plan_id === 'string' ? row.plan_id : null
            const status = typeof row.status === 'string' ? row.status : null
            const count = typeof row.count === 'number' ? row.count : null

            if (!planId || !status || count === null) {
              return null
            }

            return {
              plan_id: planId,
              status,
              count
            }
          })
          .filter((item): item is PlatformPlanDistributionItem => item !== null)
      : []

    return {
      total_organizations: typeof raw.total_organizations === 'number' ? raw.total_organizations : 0,
      total_users: typeof raw.total_users === 'number' ? raw.total_users : 0,
      total_projects: typeof raw.total_projects === 'number' ? raw.total_projects : 0,
      total_environments: typeof raw.total_environments === 'number' ? raw.total_environments : 0,
      total_variables: typeof raw.total_variables === 'number' ? raw.total_variables : 0,
      plan_distribution: distribution
    }
  }

  const getUserId = () => user.value?.id ?? user.value?.sub ?? null

  const isPlatformAdmin = async (forceRefresh = false): Promise<boolean> => {
    const userId = getUserId()

    if (!userId) {
      platformAdminCache.value = false
      return false
    }

    const now = Date.now()
    const isCacheValid =
      platformAdminCache.value !== null &&
      now - platformAdminCheckedAt.value < PLATFORM_ADMIN_CACHE_TTL_MS

    if (!forceRefresh && isCacheValid) {
      return platformAdminCache.value === true
    }

    const { data, error } = await client
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.warn('[usePlatformAdmin] Failed to check platform admin status:', error)
      platformAdminCache.value = false
      platformAdminCheckedAt.value = now
      return false
    }

    platformAdminCache.value = !!data
    platformAdminCheckedAt.value = now

    return !!data
  }

  const fetchStats = async (): Promise<PlatformStats> => {
    try {
      const { data, error } = await client.rpc('get_platform_stats')

      if (error) throw error

      return parsePlatformStats(data as Json | null)
    } catch (err) {
      console.error('[usePlatformAdmin] Failed to fetch platform stats:', err)

      const isAuthErr = await handleError(err)
      if (isAuthErr) throw err

      $toast.error('Failed to load platform stats')
      throw err
    }
  }

  const fetchOrganizations = async (): Promise<PlatformOrganizationSummary[]> => {
    try {
      const { data: organizations, error: orgError } = await client
        .from('organizations')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })

      if (orgError) throw orgError

      if (!organizations || organizations.length === 0) {
        return []
      }

      const orgIds = organizations.map(org => org.id)

      const [{ data: subscriptions, error: subscriptionError }, { data: members, error: membersError }, { data: integrations, error: integrationsError }, activityResult] = await Promise.all([
        client
          .from('organization_subscriptions')
          .select('organization_id, plan_id, status, trial_end_date, current_period_end, updated_at')
          .in('organization_id', orgIds),
        client
          .from('organization_members')
          .select('organization_id')
          .in('organization_id', orgIds),
        client
          .from('platform_integrations')
          .select('organization_id')
          .in('organization_id', orgIds)
          .is('disconnected_at', null),
        // activityResult is intentionally not destructured — its failure is non-fatal (degrades to 0/null below)
        client.rpc('get_platform_organization_activity')
      ])

      if (subscriptionError) throw subscriptionError
      if (membersError) throw membersError
      if (integrationsError) throw integrationsError

      const subscriptionByOrgId = new Map<string, PlatformOrganizationSummary['subscription']>()
      for (const subscription of subscriptions || []) {
        subscriptionByOrgId.set(subscription.organization_id, {
          plan_id: subscription.plan_id,
          status: subscription.status,
          trial_end_date: subscription.trial_end_date,
          current_period_end: subscription.current_period_end,
          updated_at: subscription.updated_at
        })
      }

      const memberCountByOrgId = new Map<string, number>()
      for (const member of members || []) {
        const currentCount = memberCountByOrgId.get(member.organization_id) || 0
        memberCountByOrgId.set(member.organization_id, currentCount + 1)
      }

      const integrationCountByOrgId = new Map<string, number>()
      for (const integration of integrations || []) {
        const currentCount = integrationCountByOrgId.get(integration.organization_id) || 0
        integrationCountByOrgId.set(integration.organization_id, currentCount + 1)
      }

      const activityByOrgId = new Map<string, Pick<PlatformOrganizationSummary, 'env_var_count' | 'last_sign_in_at'>>()
      if (activityResult.error) {
        console.warn('[usePlatformAdmin] Failed to fetch organization activity:', activityResult.error)
      } else {
        for (const activity of activityResult.data || []) {
          activityByOrgId.set(activity.organization_id, {
            env_var_count: activity.env_var_count ?? 0,
            last_sign_in_at: activity.last_sign_in_at ?? null
          })
        }
      }

      const ownerEmailByOrgId = new Map<string, string | null>()

      await Promise.all(
        orgIds.map(async (organizationId) => {
          const { data: memberRows, error } = await client.rpc('get_organization_members_with_emails', {
            org_id: organizationId
          })

          if (error) {
            console.warn(`[usePlatformAdmin] Failed to fetch owner for organization ${organizationId}:`, error)
            ownerEmailByOrgId.set(organizationId, null)
            return
          }

          const typedRows = (memberRows || []) as PlatformOrganizationMember[]
          const owner = typedRows.find(member => member.role === 'owner')
          ownerEmailByOrgId.set(organizationId, owner?.email || null)
        })
      )

      return organizations.map(org => {
        const activity = activityByOrgId.get(org.id)
        return {
          id: org.id,
          name: org.name,
          created_at: org.created_at,
          owner_email: ownerEmailByOrgId.get(org.id) || null,
          member_count: memberCountByOrgId.get(org.id) || 0,
          integration_count: integrationCountByOrgId.get(org.id) || 0,
          env_var_count: activity?.env_var_count ?? 0,
          last_sign_in_at: activity?.last_sign_in_at ?? null,
          subscription: subscriptionByOrgId.get(org.id) || null
        }
      })
    } catch (err) {
      console.error('[usePlatformAdmin] Failed to fetch organizations:', err)

      const isAuthErr = await handleError(err)
      if (isAuthErr) throw err

      $toast.error('Failed to load organizations')
      throw err
    }
  }

  const fetchOrganizationDetail = async (organizationId: string): Promise<PlatformOrganizationDetail> => {
    try {
      const [organizationResult, subscriptionResult, membersResult, billingEventsResult, countsResult, integrationsResult, githubResult] = await Promise.allSettled([
        client
          .from('organizations')
          .select('*')
          .eq('id', organizationId)
          .single(),
        client
          .from('organization_subscriptions')
          .select('*')
          .eq('organization_id', organizationId)
          .maybeSingle(),
        client.rpc('get_organization_members_with_emails', { org_id: organizationId }),
        client
          .from('billing_events')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(100),
        client.rpc('get_platform_organization_counts', { org_id: organizationId }),
        client
          .from('platform_integrations')
          .select('platform, name, connected_at, token_valid')
          .eq('organization_id', organizationId)
          .is('disconnected_at', null)
          .order('connected_at', { ascending: false }),
        client
          .from('github_installations')
          .select('account_login, account_type, installed_at')
          .eq('organization_id', organizationId)
          .is('uninstalled_at', null)
      ])

      if (organizationResult.status === 'rejected') throw organizationResult.reason
      if (subscriptionResult.status === 'rejected') throw subscriptionResult.reason

      const organizationQuery = organizationResult.value
      const subscriptionQuery = subscriptionResult.value

      if (organizationQuery.error) throw organizationQuery.error
      if (subscriptionQuery.error) throw subscriptionQuery.error

      let members: PlatformOrganizationMember[] = []
      if (membersResult.status === 'fulfilled' && !membersResult.value.error) {
        members = (membersResult.value.data || []) as PlatformOrganizationMember[]
      } else {
        const { data: fallbackMembers, error: fallbackMembersError } = await client
          .from('organization_members')
          .select('id, user_id, role, created_at')
          .eq('organization_id', organizationId)

        if (fallbackMembersError) {
          console.warn('[usePlatformAdmin] Failed to fetch organization members via fallback:', fallbackMembersError)
        } else {
          members = (fallbackMembers || []).map(member => ({
            id: member.id,
            user_id: member.user_id,
            role: member.role,
            created_at: member.created_at,
            email: 'Unknown',
            environment_access_count: 0
          }))
        }
      }

      let billingEvents: BillingEventRow[] = []
      if (billingEventsResult.status === 'fulfilled' && !billingEventsResult.value.error) {
        billingEvents = billingEventsResult.value.data || []
      } else if (billingEventsResult.status === 'fulfilled' && billingEventsResult.value.error) {
        console.warn('[usePlatformAdmin] Failed to fetch billing events:', billingEventsResult.value.error)
      } else if (billingEventsResult.status === 'rejected') {
        console.warn('[usePlatformAdmin] Failed to fetch billing events:', billingEventsResult.reason)
      }

      let countsRow: PlatformOrganizationCounts | null = null
      if (countsResult.status === 'fulfilled' && !countsResult.value.error) {
        countsRow = countsResult.value.data?.[0] ?? null
      } else if (countsResult.status === 'fulfilled' && countsResult.value.error) {
        console.warn('[usePlatformAdmin] Failed to fetch organization counts:', countsResult.value.error)
      } else if (countsResult.status === 'rejected') {
        console.warn('[usePlatformAdmin] Failed to fetch organization counts:', countsResult.reason)
      }

      const stats: PlatformOrganizationCounts = {
        projects_count: countsRow?.projects_count ?? 0,
        environments_count: countsRow?.environments_count ?? 0,
        variables_count: countsRow?.variables_count ?? 0
      }
      const owner = members.find(member => member.role === 'owner')

      let integrations: PlatformOrganizationIntegration[] = []
      if (integrationsResult.status === 'fulfilled' && !integrationsResult.value.error) {
        integrations = (integrationsResult.value.data || []) as PlatformOrganizationIntegration[]
      }

      let githubInstallations: PlatformOrganizationGitHubInstallation[] = []
      if (githubResult.status === 'fulfilled' && !githubResult.value.error) {
        githubInstallations = (githubResult.value.data || []) as PlatformOrganizationGitHubInstallation[]
      }

      return {
        organization: organizationQuery.data,
        owner_email: owner?.email || null,
        member_count: members.length,
        stats,
        members,
        subscription: subscriptionQuery.data,
        billing_events: billingEvents,
        integrations,
        github_installations: githubInstallations
      }
    } catch (err) {
      console.error('[usePlatformAdmin] Failed to fetch organization detail:', err)

      const isAuthErr = await handleError(err)
      if (isAuthErr) throw err

      $toast.error('Failed to load organization details')
      throw err
    }
  }

  const updateSubscription = async (
    organizationId: string,
    updates: PlatformSubscriptionUpdate
  ): Promise<OrganizationSubscriptionRow> => {
    const payload: Database['public']['Tables']['organization_subscriptions']['Update'] = {}

    if (updates.plan_id !== undefined) payload.plan_id = updates.plan_id
    if (updates.status !== undefined) payload.status = updates.status
    if (updates.trial_end_date !== undefined) payload.trial_end_date = updates.trial_end_date
    if (updates.trial_start_date !== undefined) payload.trial_start_date = updates.trial_start_date
    if (updates.current_period_end !== undefined) payload.current_period_end = updates.current_period_end
    if (updates.current_period_start !== undefined) payload.current_period_start = updates.current_period_start
    if (updates.cancel_at_period_end !== undefined) payload.cancel_at_period_end = updates.cancel_at_period_end
    if (updates.canceled_at !== undefined) payload.canceled_at = updates.canceled_at

    if (Object.keys(payload).length === 0) {
      throw new Error('No subscription changes were provided')
    }

    try {
      const userId = getUserId()

      const { data: currentSubscription, error: currentSubscriptionError } = await client
        .from('organization_subscriptions')
        .select('id, plan_id, status')
        .eq('organization_id', organizationId)
        .single()

      if (currentSubscriptionError) throw currentSubscriptionError

      const { data: updatedSubscription, error: updateError } = await client
        .from('organization_subscriptions')
        .update(payload)
        .eq('organization_id', organizationId)
        .select('*')
        .single()

      if (updateError) throw updateError

      client
        .from('billing_events')
        .insert({
          organization_id: organizationId,
          subscription_id: updatedSubscription.id,
          event_type: 'subscription_updated',
          from_plan_id: currentSubscription.plan_id,
          to_plan_id: updatedSubscription.plan_id,
          triggered_by: userId,
          details: {
            source: 'platform_admin',
            updated_fields: Object.keys(payload),
            previous_status: currentSubscription.status,
            next_status: updatedSubscription.status
          }
        })
        .then(({ error }) => {
          if (error) {
            console.error('[usePlatformAdmin] Failed to log billing event:', error)
          }
        })

      return updatedSubscription
    } catch (err) {
      console.error('[usePlatformAdmin] Failed to update subscription:', err)

      const isAuthErr = await handleError(err)
      if (isAuthErr) throw err

      $toast.error('Failed to update subscription')
      throw err
    }
  }

  const deleteOrganization = async (organizationId: string): Promise<string> => {
    try {
      const { data, error } = await client.rpc('admin_delete_organization', {
        p_org_id: organizationId
      })

      if (error) throw error

      return (data as string) ?? ''
    } catch (err) {
      console.error('[usePlatformAdmin] Failed to delete organization:', err)

      const isAuthErr = await handleError(err)
      if (isAuthErr) throw err

      $toast.error('Failed to delete organization')
      throw err
    }
  }

  return {
    isPlatformAdmin,
    fetchStats,
    fetchOrganizations,
    fetchOrganizationDetail,
    updateSubscription,
    deleteOrganization
  }
}
