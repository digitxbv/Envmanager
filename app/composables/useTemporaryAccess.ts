// =====================================================
// Temporary Access Composables for Secure Value Viewing
// =====================================================
// Part A: useTemporaryAccess - batch-fetch grants for current user
// Part B: useAccessRequestsAdmin - admin side management

// =====================================================
// Types
// =====================================================

interface TemporaryAccessGrant {
  id: string
  variable_id: string
  environment_id: string
  organization_id: string
  requested_by: string
  requested_at: string
  request_reason: string
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'revoked'
  reviewed_by: string | null
  reviewed_at: string | null
  denial_reason: string | null
  access_duration_minutes: number | null
  access_expires_at: string | null
  reveal_count: number
  max_reveals: number
}

interface EnrichedRequest extends TemporaryAccessGrant {
  requester_email: string
  variable_key: string
  project_name: string
  environment_name: string
}

// =====================================================
// Part A: useTemporaryAccess
// =====================================================
// Batch-fetches ALL temporary_access_grants for current user + environment

export function useTemporaryAccess(environmentId: Ref<string> | string) {
  const client = useSupabaseClient()
  const user = useSupabaseUser()

  // =====================================================
  // Reactive State
  // =====================================================

  const grants = ref<TemporaryAccessGrant[]>([])
  const grantsByVariableId = ref<Record<string, TemporaryAccessGrant>>({})
  const isLoading = ref(false)

  // =====================================================
  // Core Fetch
  // =====================================================

  const fetchGrants = async () => {
    const envId = toValue(environmentId)
    const userId = user.value?.id ?? user.value?.sub

    if (!envId || !userId) {
      grants.value = []
      grantsByVariableId.value = {}
      return
    }

    isLoading.value = true

    try {
      const { data, error } = await client
        .from('temporary_access_grants')
        .select('*')
        .eq('environment_id', envId)
        .eq('requested_by', userId)
        .in('status', ['pending', 'approved'])

      if (error) {
        console.error('[useTemporaryAccess] Failed to fetch grants:', error)
        grants.value = []
        grantsByVariableId.value = {}
        return
      }

      grants.value = (data ?? []) as TemporaryAccessGrant[]

      // Build lookup map by variable_id
      const map: Record<string, TemporaryAccessGrant> = {}
      for (const grant of grants.value) {
        // If multiple grants exist for same variable, prefer approved over pending
        const existing = map[grant.variable_id]
        if (!existing || (grant.status === 'approved' && existing.status === 'pending')) {
          map[grant.variable_id] = grant
        }
      }
      grantsByVariableId.value = map
    } catch (err) {
      console.error('[useTemporaryAccess] Error:', err)
      grants.value = []
      grantsByVariableId.value = {}
    } finally {
      isLoading.value = false
    }
  }

  // =====================================================
  // Public Methods
  // =====================================================

  const getGrantStatus = (variableId: string): 'none' | 'pending' | 'approved' => {
    const grant = grantsByVariableId.value[variableId]
    if (!grant) return 'none'

    if (grant.status === 'approved') {
      // Check if expired
      if (grant.access_expires_at && new Date(grant.access_expires_at) <= new Date()) {
        return 'none'
      }
      return 'approved'
    }

    return grant.status as 'pending' | 'none'
  }

  const getActiveGrant = (variableId: string): TemporaryAccessGrant | null => {
    const grant = grantsByVariableId.value[variableId]
    if (!grant) return null

    if (grant.status === 'approved' && grant.access_expires_at) {
      if (new Date(grant.access_expires_at) > new Date()) {
        return grant
      }
    }

    return null
  }

  const hasPendingRequest = (variableId: string): boolean => {
    const grant = grantsByVariableId.value[variableId]
    return grant?.status === 'pending'
  }

  const hasActiveAccess = (variableId: string): boolean => {
    return getActiveGrant(variableId) !== null
  }

  const requestAccess = async (
    variableId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await client.rpc('request_secret_access', {
        p_variable_id: variableId,
        p_reason: reason
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // Refresh grants to pick up the new pending request
      await fetchGrants()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  const revealValue = async (
    variableId: string
  ): Promise<{ value?: string; error?: string }> => {
    try {
      const { data, error } = await client.rpc('reveal_secret_value', {
        p_variable_id: variableId,
        p_ip_address: null,
        p_user_agent: navigator?.userAgent ?? null
      })

      if (error) {
        return { error: error.message }
      }

      // Refresh to update reveal_count
      await fetchGrants()
      return { value: data as string }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { error: message }
    }
  }

  // =====================================================
  // Watchers
  // =====================================================

  watch(
    isRef(environmentId) ? environmentId : () => environmentId,
    () => {
      fetchGrants()
    },
    { immediate: true }
  )

  // =====================================================
  // Return Public API
  // =====================================================

  return {
    grants: readonly(grants),
    grantsByVariableId: readonly(grantsByVariableId),
    getGrantStatus,
    getActiveGrant,
    hasPendingRequest,
    hasActiveAccess,
    requestAccess,
    revealValue,
    refresh: fetchGrants,
    isLoading: readonly(isLoading)
  }
}

// =====================================================
// Part B: useAccessRequestsAdmin
// =====================================================
// Admin-side: fetch pending requests, approve, deny

export function useAccessRequestsAdmin(organizationId: Ref<string> | string) {
  const client = useSupabaseClient()

  // =====================================================
  // Reactive State
  // =====================================================

  const pendingRequests = ref<EnrichedRequest[]>([])
  const pendingCount = ref(0)
  const isLoading = ref(false)

  // =====================================================
  // Core Fetch
  // =====================================================

  const fetchPendingRequests = async () => {
    const orgId = toValue(organizationId)
    if (!orgId) {
      pendingRequests.value = []
      pendingCount.value = 0
      return
    }

    isLoading.value = true

    try {
      // 1. Fetch pending grants
      const { data: grantsData, error: grantsError } = await client
        .from('temporary_access_grants')
        .select('*')
        .eq('organization_id', orgId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })

      if (grantsError) {
        console.error('[useAccessRequestsAdmin] Failed to fetch grants:', grantsError)
        pendingRequests.value = []
        return
      }

      const grants = (grantsData ?? []) as TemporaryAccessGrant[]

      if (grants.length === 0) {
        pendingRequests.value = []
        pendingCount.value = 0
        return
      }

      // 2. Batch-fetch variable keys
      const variableIds = [...new Set(grants.map(g => g.variable_id))]
      const { data: varsData, error: varsError } = await client
        .from('variables')
        .select('id, key')
        .in('id', variableIds)

      if (varsError) {
        console.error('[useAccessRequestsAdmin] Failed to fetch variables:', varsError)
      }

      const variableKeyMap: Record<string, string> = {}
      for (const v of (varsData ?? [])) {
        variableKeyMap[v.id] = v.key
      }

      // 3. Batch-fetch environments with their project info
      const environmentIds = [...new Set(grants.map(g => g.environment_id))]
      const { data: envsData, error: envsError } = await client
        .from('environments')
        .select('id, name, project_id, projects(id, name)')
        .in('id', environmentIds)

      if (envsError) {
        console.error('[useAccessRequestsAdmin] Failed to fetch environments:', envsError)
      }

      const environmentMap: Record<string, { name: string; projectName: string }> = {}
      for (const env of (envsData ?? [])) {
        const project = env.projects as { id: string; name: string } | null
        environmentMap[env.id] = {
          name: env.name,
          projectName: project?.name ?? 'Unknown'
        }
      }

      // 5. Fetch member emails via RPC
      const { data: membersData, error: membersError } = await client.rpc(
        'get_organization_members_with_emails',
        { org_id: orgId }
      )

      if (membersError) {
        console.error('[useAccessRequestsAdmin] Failed to fetch members:', membersError)
      }

      const emailMap: Record<string, string> = {}
      for (const m of (membersData ?? [])) {
        emailMap[m.user_id] = m.email
      }

      // 6. Enrich grants
      const enriched: EnrichedRequest[] = grants.map(grant => {
        const envInfo = environmentMap[grant.environment_id]
        return {
          ...grant,
          requester_email: emailMap[grant.requested_by] ?? 'Unknown',
          variable_key: variableKeyMap[grant.variable_id] ?? 'Unknown',
          project_name: envInfo?.projectName ?? 'Unknown',
          environment_name: envInfo?.name ?? 'Unknown'
        }
      })

      pendingRequests.value = enriched
      pendingCount.value = enriched.length
    } catch (err) {
      console.error('[useAccessRequestsAdmin] Error:', err)
      pendingRequests.value = []
      pendingCount.value = 0
    } finally {
      isLoading.value = false
    }
  }

  const refreshCount = async () => {
    const orgId = toValue(organizationId)
    if (!orgId) {
      pendingCount.value = 0
      return
    }

    try {
      const { data, error } = await client.rpc('get_pending_access_requests_count', {
        p_org_id: orgId
      })

      if (error) {
        console.error('[useAccessRequestsAdmin] Failed to fetch count:', error)
        return
      }

      pendingCount.value = data ?? 0
    } catch (err) {
      console.error('[useAccessRequestsAdmin] Count error:', err)
    }
  }

  // =====================================================
  // Public Methods
  // =====================================================

  const approve = async (
    grantId: string,
    durationMinutes: number
  ): Promise<boolean> => {
    try {
      const { error } = await client.rpc('grant_access', {
        p_grant_id: grantId,
        p_duration_minutes: durationMinutes
      })

      if (error) {
        console.error('[useAccessRequestsAdmin] Approve failed:', error)
        return false
      }

      // Refresh list
      await fetchPendingRequests()
      return true
    } catch (err) {
      console.error('[useAccessRequestsAdmin] Approve error:', err)
      return false
    }
  }

  const deny = async (grantId: string, reason?: string): Promise<boolean> => {
    try {
      const { error } = await client.rpc('deny_access', {
        p_grant_id: grantId,
        p_reason: reason
      })

      if (error) {
        console.error('[useAccessRequestsAdmin] Deny failed:', error)
        return false
      }

      // Refresh list
      await fetchPendingRequests()
      return true
    } catch (err) {
      console.error('[useAccessRequestsAdmin] Deny error:', err)
      return false
    }
  }

  // =====================================================
  // Watchers
  // =====================================================

  watch(
    isRef(organizationId) ? organizationId : () => organizationId,
    () => {
      fetchPendingRequests()
    },
    { immediate: true }
  )

  // =====================================================
  // Return Public API
  // =====================================================

  return {
    pendingRequests: readonly(pendingRequests),
    pendingCount: readonly(pendingCount),
    isLoading: readonly(isLoading),
    approve,
    deny,
    refresh: fetchPendingRequests,
    refreshCount
  }
}
