// =====================================================
// Pending Changes Composable
// =====================================================
// Core composable for managing approval workflow pending changes

import type { Ref } from 'vue'
import type { Tables } from '~/types/database.types'

// =====================================================
// Types
// =====================================================

export interface PendingChange {
  id: string
  environment_id: string
  organization_id: string
  variable_id: string | null
  action: 'create' | 'update' | 'delete'
  variable_key: string | null
  variable_value: string | null
  is_secret: boolean
  old_key: string | null
  old_value: string | null
  requested_by: string
  requested_at: string
  comment: string | null
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  first_approver: string | null
  first_approved_at: string | null
  expires_at: string | null
  // Joined fields
  requester_email?: string
  reviewer_email?: string
  first_approver_email?: string
  environment_name?: string
  project_name?: string
  project_id?: string
}

export interface SubmitChangeParams {
  environmentId: string
  action: 'create' | 'update' | 'delete'
  variableId?: string
  key?: string
  value?: string
  isSecret?: boolean
  comment?: string
}

// =====================================================
// Composable
// =====================================================

export function usePendingChanges(environmentId?: Ref<string> | string) {
  const client = useSupabaseClient()
  const user = useSupabaseUser()
  const { $toast } = useNuxtApp()

  // =====================================================
  // Reactive State
  // =====================================================

  const pendingChanges = ref<PendingChange[]>([])
  const pendingCount = ref(0)
  const isLoading = ref(false)

  // =====================================================
  // Helper to get environment ID value
  // =====================================================

  const getEnvId = (): string | undefined => {
    if (!environmentId) return undefined
    return typeof environmentId === 'string' ? environmentId : environmentId.value
  }

  // =====================================================
  // Methods
  // =====================================================

  /**
   * Fetch pending changes for an environment or organization
   */
  const fetchPendingChanges = async (
    envId?: string,
    organizationId?: string
  ) => {
    isLoading.value = true

    try {
      // Use provided envId, or fall back to composable's environmentId
      const targetEnvId = envId || getEnvId()

      let query = client
        .from('pending_changes')
        .select(`
          *,
          environments!inner(name, projects!inner(name, id))
        `)
        .order('requested_at', { ascending: false })

      // Apply filters
      if (targetEnvId) {
        query = query.eq('environment_id', targetEnvId)
      } else if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      const { data, error } = await query

      if (error) throw error

      // Resolve emails via org members RPC
      const orgId = organizationId || data?.[0]?.organization_id || null
      let emailMap: Record<string, string> = {}

      if (orgId) {
        const { data: membersData } = await client.rpc(
          'get_organization_members_with_emails',
          { org_id: orgId }
        )
        for (const m of (membersData ?? [])) {
          emailMap[m.user_id] = m.email
        }
      }

      // Map data to include environment name, project info, and emails
      pendingChanges.value = (data || []).map((change) => {
        const env = change.environments as { name: string; projects: { name: string; id: string } } | null
        return {
          id: change.id,
          environment_id: change.environment_id,
          organization_id: change.organization_id,
          variable_id: change.variable_id,
          action: change.action as 'create' | 'update' | 'delete',
          variable_key: change.variable_key,
          variable_value: change.variable_value,
          is_secret: change.is_secret ?? false,
          old_key: change.old_key,
          old_value: change.old_value,
          requested_by: change.requested_by,
          requested_at: change.requested_at ?? new Date().toISOString(),
          comment: change.comment,
          status: change.status as PendingChange['status'],
          reviewed_by: change.reviewed_by,
          reviewed_at: change.reviewed_at,
          rejection_reason: change.rejection_reason,
          first_approver: change.first_approver,
          first_approved_at: change.first_approved_at,
          expires_at: change.expires_at,
          environment_name: env?.name,
          project_name: env?.projects?.name,
          project_id: env?.projects?.id,
          requester_email: emailMap[change.requested_by] ?? undefined,
          reviewer_email: change.reviewed_by ? (emailMap[change.reviewed_by] ?? undefined) : undefined,
          first_approver_email: change.first_approver ? (emailMap[change.first_approver] ?? undefined) : undefined
        }
      })

      pendingCount.value = pendingChanges.value.filter(c => c.status === 'pending').length

      return pendingChanges.value
    } catch (err) {
      console.error('[usePendingChanges] Failed to fetch pending changes:', err)
      $toast.error('Failed to load pending changes')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Submit a change for approval
   */
  const submitChange = async (params: SubmitChangeParams): Promise<string | null> => {
    isLoading.value = true

    try {
      const { data, error } = await client.rpc('submit_pending_change', {
        p_environment_id: params.environmentId,
        p_action: params.action,
        p_variable_id: params.variableId,
        p_key: params.key,
        p_value: params.value,
        p_is_secret: params.isSecret,
        p_comment: params.comment
      })

      if (error) throw error

      $toast.success('Change submitted for approval')
      return data as string
    } catch (err) {
      console.error('[usePendingChanges] Failed to submit change:', err)
      $toast.error('Failed to submit change for approval')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Approve a pending change
   */
  const approve = async (changeId: string): Promise<boolean> => {
    isLoading.value = true

    try {
      const { data, error } = await client.rpc('approve_pending_change', {
        p_change_id: changeId
      })

      if (error) throw error

      $toast.success('Change approved successfully')
      return data as boolean
    } catch (err) {
      console.error('[usePendingChanges] Failed to approve change:', err)
      $toast.error('Failed to approve change')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Reject a pending change
   */
  const reject = async (changeId: string, reason?: string): Promise<boolean> => {
    isLoading.value = true

    try {
      const { data, error } = await client.rpc('reject_pending_change', {
        p_change_id: changeId,
        p_reason: reason
      })

      if (error) throw error

      $toast.success('Change rejected')
      return data as boolean
    } catch (err) {
      console.error('[usePendingChanges] Failed to reject change:', err)
      $toast.error('Failed to reject change')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Check if current user can approve a pending change
   */
  const checkCanApprove = async (changeId: string): Promise<boolean> => {
    try {
      const { data, error } = await client.rpc('can_approve_pending_change', {
        p_change_id: changeId
      })

      if (error) throw error

      return data as boolean
    } catch (err) {
      console.error('[usePendingChanges] Failed to check approval permission:', err)
      return false
    }
  }

  /**
   * Cancel a pending change (only by the requester)
   */
  const cancelChange = async (changeId: string): Promise<boolean> => {
    const userId = user.value?.id ?? user.value?.sub
    if (!userId) {
      $toast.error('You must be logged in')
      return false
    }

    isLoading.value = true

    try {
      // Verify the current user is the requester
      const { data: change, error: fetchError } = await client
        .from('pending_changes')
        .select('requested_by, status')
        .eq('id', changeId)
        .single()

      if (fetchError) throw fetchError

      if (change.requested_by !== userId) {
        $toast.error('You can only cancel your own requests')
        return false
      }

      if (change.status !== 'pending') {
        $toast.error('Can only cancel pending changes')
        return false
      }

      const { error: updateError } = await client
        .from('pending_changes')
        .update({ status: 'cancelled' })
        .eq('id', changeId)

      if (updateError) throw updateError

      $toast.success('Change request cancelled')
      return true
    } catch (err) {
      console.error('[usePendingChanges] Failed to cancel change:', err)
      $toast.error('Failed to cancel change request')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch count of pending changes user can approve
   */
  const fetchPendingCount = async (organizationId: string): Promise<number> => {
    try {
      const { data, error } = await client
        .from('pending_changes')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'pending')

      if (error) throw error

      pendingCount.value = data?.length ?? 0
      return pendingCount.value
    } catch (err) {
      console.error('[usePendingChanges] Failed to fetch pending count:', err)
      return 0
    }
  }

  return {
    pendingChanges,
    pendingCount,
    isLoading,
    fetchPendingChanges,
    submitChange,
    approve,
    reject,
    checkCanApprove,
    cancelChange,
    fetchPendingCount,
    refresh: fetchPendingChanges
  }
}
