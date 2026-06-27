import type { Database } from '@/types/database.types'

interface VersionEntry {
  id: string
  variable_key: string | null
  version_number: number | null
  action: string | null
  old_value: string | null
  new_value: string | null
  change_reason: string | null
  user_id: string | null
  user_email: string | null
  created_at: string | null
  batch_id: string | null
  metadata: Record<string, any> | null
}

interface RollbackResult {
  success: boolean
  pending_change_id: string | null
  new_version: number | null
}

export function useVariableHistory() {
  const client = useSupabaseClient<Database>()

  const history = ref<VersionEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hasMore = ref(true)

  async function getHistory(variableId: string, limit = 50, offset = 0) {
    loading.value = true
    error.value = null

    try {
      const { data, error: rpcError } = await client.rpc('get_variable_history', {
        p_variable_id: variableId,
        p_limit: limit,
        p_offset: offset
      })

      if (rpcError) throw rpcError

      const entries = (data || []) as VersionEntry[]

      if (offset === 0) {
        history.value = entries
      } else {
        history.value = [...history.value, ...entries]
      }

      hasMore.value = entries.length === limit
      return entries
    } catch (e: any) {
      error.value = e.message || 'Failed to load history'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function rollbackToVersion(variableId: string, targetVersion: number, reason: string): Promise<RollbackResult> {
    loading.value = true
    error.value = null

    try {
      const { data, error: rpcError } = await client.rpc('rollback_variable', {
        p_variable_id: variableId,
        p_target_version: targetVersion,
        p_reason: reason
      })

      if (rpcError) throw rpcError
      return data as unknown as RollbackResult
    } catch (e: any) {
      error.value = e.message || 'Failed to rollback'
      throw e
    } finally {
      loading.value = false
    }
  }

  function reset() {
    history.value = []
    loading.value = false
    error.value = null
    hasMore.value = true
  }

  return {
    history: readonly(history),
    loading: readonly(loading),
    error: readonly(error),
    hasMore: readonly(hasMore),
    getHistory,
    rollbackToVersion,
    reset
  }
}
