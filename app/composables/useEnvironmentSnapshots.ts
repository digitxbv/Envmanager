import type { Database } from '@/types/database.types'

interface Snapshot {
  id: string
  environment_id: string
  organization_id: string
  name: string
  description: string | null
  snapshot_data: any
  variable_count: number
  created_by: string
  created_at: string
}

interface SnapshotDiff {
  added: Array<{ key: string; snapshot_value: string }>
  removed: Array<{ key: string; current_value: string }>
  modified: Array<{ key: string; snapshot_value: string; current_value: string; is_secret?: boolean }>
  unchanged: number
}

interface RestoreResult {
  success: boolean
  added: number
  removed: number
  modified: number
  pending: number
}

export function useEnvironmentSnapshots(environmentId: MaybeRef<string>) {
  const client = useSupabaseClient<Database>()

  const snapshots = ref<Snapshot[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function listSnapshots() {
    const envId = toValue(environmentId)
    if (!envId) return

    loading.value = true
    error.value = null

    try {
      const { data, error: queryError } = await client
        .from('environment_snapshots')
        .select('*')
        .eq('environment_id', envId)
        .order('created_at', { ascending: false })

      if (queryError) throw queryError
      snapshots.value = (data || []) as Snapshot[]
    } catch (e: any) {
      error.value = e.message || 'Failed to load snapshots'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createSnapshot(name: string, description?: string): Promise<string> {
    loading.value = true
    error.value = null

    try {
      const { data, error: rpcError } = await client.rpc('create_environment_snapshot', {
        p_environment_id: toValue(environmentId),
        p_name: name,
        p_description: description ?? undefined
      })

      if (rpcError) throw rpcError

      // Refresh list
      await listSnapshots()
      return data as string
    } catch (e: any) {
      error.value = e.message || 'Failed to create snapshot'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function compareToCurrentState(snapshotId: string): Promise<SnapshotDiff> {
    loading.value = true
    error.value = null

    try {
      const { data, error: rpcError } = await client.rpc('compare_snapshot_to_current', {
        p_snapshot_id: snapshotId
      })

      if (rpcError) throw rpcError
      return data as unknown as SnapshotDiff
    } catch (e: any) {
      error.value = e.message || 'Failed to compare snapshot'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function restoreSnapshot(snapshotId: string, reason: string): Promise<RestoreResult> {
    loading.value = true
    error.value = null

    try {
      const { data, error: rpcError } = await client.rpc('restore_environment_snapshot', {
        p_snapshot_id: snapshotId,
        p_reason: reason
      })

      if (rpcError) throw rpcError
      return data as unknown as RestoreResult
    } catch (e: any) {
      error.value = e.message || 'Failed to restore snapshot'
      throw e
    } finally {
      loading.value = false
    }
  }

  // Auto-fetch when environmentId changes
  watch(() => toValue(environmentId), (newId) => {
    if (newId) listSnapshots()
  })

  return {
    snapshots: readonly(snapshots),
    loading: readonly(loading),
    error: readonly(error),
    listSnapshots,
    createSnapshot,
    compareToCurrentState,
    restoreSnapshot
  }
}
