// =====================================================
// Activity Log Composable
// =====================================================
// Fetches unified activity log from variable_audit_log and import_history

export interface ActivityLogEntry {
  id: string
  type: 'variable' | 'import' | 'secret_view'
  action: string
  user_email: string | null
  project_id: string
  project_name: string
  environment_id: string
  environment_name: string
  variable_key?: string | null
  file_name?: string | null
  old_value?: string | null
  new_value?: string | null
  variables_imported?: number | null
  variables_skipped?: number | null
  variables_overwritten?: number | null
  created_at: string
}

export interface ActivityLogFilters {
  projectId?: string | null
  environmentId?: string | null
  action?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}

export const useActivityLog = () => {
  const client = useSupabaseClient()
  const { $toast } = useNuxtApp()

  // State
  const entries = ref<ActivityLogEntry[]>([])
  const loading = ref(false)
  const totalCount = ref(0)
  const page = ref(1)
  const pageSize = 25

  /**
   * Fetch activity log entries with filters and pagination
   */
  const fetchActivityLog = async (
    organizationId: string,
    filters: ActivityLogFilters = {},
    currentPage: number = 1
  ) => {
    if (!organizationId) {
      console.warn('[useActivityLog] No organization ID provided')
      return
    }

    loading.value = true
    page.value = currentPage

    try {
      const offset = (currentPage - 1) * pageSize

      const { data, error } = await client.rpc('get_activity_log', {
        p_organization_id: organizationId,
        p_limit: pageSize,
        p_offset: offset,
        p_project_id: filters.projectId ?? undefined,
        p_environment_id: filters.environmentId ?? undefined,
        p_action: filters.action ?? undefined,
        p_date_from: filters.dateFrom ?? undefined,
        p_date_to: filters.dateTo ?? undefined
      })

      if (error) {
        // Check for permission error
        if (error.message?.includes('Only owners and admins')) {
          console.warn('[useActivityLog] User does not have permission')
          entries.value = []
          totalCount.value = 0
          return
        }
        throw error
      }

      entries.value = (data || []) as ActivityLogEntry[]
      // Get total count from first row (all rows have same total_count)
      totalCount.value = data?.[0]?.total_count || 0
    } catch (err) {
      console.error('[useActivityLog] Failed to fetch activity log:', err)
      $toast.error('Failed to load activity log')
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Reset state
   */
  const reset = () => {
    entries.value = []
    loading.value = false
    totalCount.value = 0
    page.value = 1
  }

  return {
    entries: readonly(entries),
    loading: readonly(loading),
    totalCount: readonly(totalCount),
    page: readonly(page),
    pageSize,
    fetchActivityLog,
    reset
  }
}
