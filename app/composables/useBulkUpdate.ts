import type { Database } from '@/types/database.types'

interface SearchResult {
  key: string
  environments: {
    id: string
    name: string
    is_protected: boolean
    variable_id: string
    value: string | null
    is_secret: boolean
  }[]
}

interface BulkUpdateInput {
  variable_id: string
  environment_id: string
  new_value: string
}

interface BulkUpdateResult {
  applied: number
  pending: number
  errors: string[]
}

export function useBulkUpdate(projectId: MaybeRef<string>) {
  const client = useSupabaseClient<Database>()

  const searchResults = ref<SearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const result = ref<BulkUpdateResult | null>(null)

  async function searchVariablesAcrossEnvironments(search: string): Promise<SearchResult[]> {
    if (!search.trim()) {
      searchResults.value = []
      return []
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: queryError } = await client
        .from('variables')
        .select('id, key, value, is_secret, environment_id, environments(id, name, is_protected)')
        .ilike('key', `%${search}%`)
        .eq('environments.project_id', unref(projectId))

      if (queryError) throw queryError

      // Group by key
      const grouped = new Map<string, SearchResult>()
      for (const row of (data || [])) {
        const env = row.environments as any
        if (!env) continue

        if (!grouped.has(row.key)) {
          grouped.set(row.key, { key: row.key, environments: [] })
        }
        grouped.get(row.key)!.environments.push({
          id: env.id,
          name: env.name,
          is_protected: env.is_protected,
          variable_id: row.id,
          value: row.value,
          is_secret: row.is_secret,
        })
      }

      searchResults.value = Array.from(grouped.values())
      return searchResults.value
    } catch (e: any) {
      error.value = e.message || 'Search failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getVariableInAllEnvironments(key: string): Promise<SearchResult | null> {
    loading.value = true
    error.value = null

    try {
      const { data, error: queryError } = await client
        .from('variables')
        .select('id, key, value, is_secret, environment_id, environments(id, name, is_protected)')
        .eq('key', key)
        .eq('environments.project_id', unref(projectId))

      if (queryError) throw queryError

      if (!data || data.length === 0) return null

      const result: SearchResult = { key, environments: [] }
      for (const row of data) {
        const env = row.environments as any
        if (!env) continue
        result.environments.push({
          id: env.id,
          name: env.name,
          is_protected: env.is_protected,
          variable_id: row.id,
          value: row.value,
          is_secret: row.is_secret,
        })
      }

      return result
    } catch (e: any) {
      error.value = e.message || 'Failed to load variable'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function applyBulkUpdate(updates: BulkUpdateInput[], reason: string): Promise<BulkUpdateResult> {
    loading.value = true
    error.value = null
    result.value = null

    try {
      const { data, error: rpcError } = await client.rpc('bulk_update_variables', {
        p_updates: updates as any,
        p_reason: reason,
      })

      if (rpcError) throw rpcError

      const res = data as unknown as BulkUpdateResult
      result.value = res
      return res
    } catch (e: any) {
      error.value = e.message || 'Bulk update failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    searchResults: readonly(searchResults),
    loading: readonly(loading),
    error: readonly(error),
    result: readonly(result),
    searchVariablesAcrossEnvironments,
    getVariableInAllEnvironments,
    applyBulkUpdate,
  }
}
