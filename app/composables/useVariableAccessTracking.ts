import type { Database } from '@/types/database.types'

interface AccessStats {
  access_type: string
  access_count: number
  last_access: string
  unique_users: number
}

interface EnvironmentAccessSummary {
  variable_id: string
  total_accesses: number
  last_accessed: string
}

export function useVariableAccessTracking() {
  const client = useSupabaseClient<Database>()

  const loading = ref(false)
  const error = ref<string | null>(null)

  // Throttle: track last logged environment + timestamp to avoid duplicate logs
  const lastLogged = ref<{ environmentId: string; timestamp: number } | null>(null)
  const THROTTLE_MS = 60_000 // 1 minute

  async function logAccess(environmentId: string, accessType: 'web_view' | 'web_decrypt') {
    // Throttle web_view to once per minute per environment
    if (accessType === 'web_view' && lastLogged.value) {
      const { environmentId: lastEnv, timestamp } = lastLogged.value
      if (lastEnv === environmentId && Date.now() - timestamp < THROTTLE_MS) {
        return
      }
    }

    try {
      const { error: rpcError } = await client.rpc('log_variable_access', {
        p_environment_id: environmentId,
        p_access_type: accessType,
      })

      if (rpcError) throw rpcError

      if (accessType === 'web_view') {
        lastLogged.value = { environmentId, timestamp: Date.now() }
      }
    } catch (e: any) {
      // Fire-and-forget — don't break the UI for tracking failures
      console.warn('Access tracking failed:', e.message)
    }
  }

  async function getAccessStats(variableId: string, days = 7): Promise<AccessStats[]> {
    loading.value = true
    error.value = null

    try {
      const { data, error: rpcError } = await client.rpc('get_variable_access_stats', {
        p_variable_id: variableId,
        p_days: days,
      })

      if (rpcError) throw rpcError
      return (data || []) as AccessStats[]
    } catch (e: any) {
      error.value = e.message || 'Failed to load access stats'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getEnvironmentAccessSummary(environmentId: string, days = 7): Promise<EnvironmentAccessSummary[]> {
    loading.value = true
    error.value = null

    try {
      const { data, error: rpcError } = await client.rpc('get_environment_access_summary', {
        p_environment_id: environmentId,
        p_days: days,
      })

      if (rpcError) throw rpcError
      return (data || []) as EnvironmentAccessSummary[]
    } catch (e: any) {
      error.value = e.message || 'Failed to load access summary'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    logAccess,
    getAccessStats,
    getEnvironmentAccessSummary,
  }
}
