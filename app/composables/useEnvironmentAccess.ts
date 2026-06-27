// =====================================================
// Environment Access Composable
// =====================================================
// Checks the current user's access level for a given environment
// using RPC functions and the environment_access table.

export type AccessLevel = 'read' | 'write' | null

export const useEnvironmentAccess = (environmentId: Ref<string> | string) => {
  const client = useSupabaseClient()
  const user = useSupabaseUser()

  // =====================================================
  // Reactive State
  // =====================================================

  const canWrite = ref(false)
  const canRead = ref(false)
  const canSeeValues = ref(false)
  const accessLevel = ref<AccessLevel>(null)
  const isLoading = ref(false)

  // =====================================================
  // Core Check
  // =====================================================

  const checkAccess = async () => {
    const envId = toValue(environmentId)
    const userId = user.value?.id ?? user.value?.sub

    if (!envId || !userId) {
      canWrite.value = false
      canRead.value = false
      canSeeValues.value = false
      accessLevel.value = null
      return
    }

    isLoading.value = true

    try {
      // Run all checks in parallel
      const [writeResult, readResult, valuesResult, accessResult] = await Promise.all([
        client.rpc('has_environment_write_access', { env_id: envId }),
        client.rpc('has_environment_read_access', { env_id: envId }),
        client.rpc('can_see_environment_values', { env_id: envId }),
        client
          .from('environment_access')
          .select('access_level')
          .eq('environment_id', envId)
          .eq('user_id', userId)
          .maybeSingle()
      ])

      // Safe defaults on error
      canWrite.value = writeResult.error ? false : !!writeResult.data
      canRead.value = readResult.error ? false : !!readResult.data
      canSeeValues.value = valuesResult.error ? false : !!valuesResult.data

      if (accessResult.error || !accessResult.data) {
        // No explicit access row - check if user is org owner/admin
        // (they may have implicit access via their role)
        if (canWrite.value) {
          accessLevel.value = 'write'
        } else if (canRead.value) {
          accessLevel.value = 'read'
        } else {
          accessLevel.value = null
        }
      } else {
        accessLevel.value = accessResult.data.access_level as AccessLevel
      }
    } catch (err) {
      console.error('[useEnvironmentAccess] Failed to check access:', err)
      // Safe defaults
      canWrite.value = false
      canRead.value = false
      canSeeValues.value = false
      accessLevel.value = null
    } finally {
      isLoading.value = false
    }
  }

  // =====================================================
  // Watchers
  // =====================================================

  watch(isRef(environmentId) ? environmentId : () => environmentId, () => {
    checkAccess()
  }, { immediate: true })

  // =====================================================
  // Return Public API
  // =====================================================

  return {
    canWrite: readonly(canWrite),
    canRead: readonly(canRead),
    canSeeValues: readonly(canSeeValues),
    accessLevel: readonly(accessLevel),
    isLoading: readonly(isLoading),
    refresh: checkAccess
  }
}
