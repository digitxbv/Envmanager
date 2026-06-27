// =====================================================
// Platform Integration Composable Factory (Simplified)
// =====================================================
// Factory function for creating platform-specific integration composables
// Organization-level connections only. Projects enable/disable via sync_configs.

import type { Database } from '~/types/database.types'
import type {
  PlatformConfig,
  PlatformConnection,
  SyncConfig,
  SyncHistoryEntry,
  SyncResult
} from '~/types/integration.types'

// =====================================================
// Factory Options
// =====================================================

export interface PlatformIntegrationOptions {
  // Edge function names (platform-specific)
  syncFunctionName: string
  validateFunctionName?: string
}

// =====================================================
// Return Type Interface
// =====================================================

export interface PlatformIntegration {
  // State
  connection: Ref<PlatformConnection | null>
  syncConfigs: Ref<SyncConfig[]>
  loading: Ref<boolean>
  error: Ref<string | null>

  // Computed
  isConnected: ComputedRef<boolean>

  // Methods
  fetchOrgConnection: (organizationId: string) => Promise<PlatformConnection | null>
  getDependentProjects: (connectionId: string) => Promise<Array<{ id: string; name: string }>>
  getDependentProjectCount: (connectionId: string) => Promise<number>
  disconnect: (connectionId: string) => Promise<void>
  fetchSyncConfigsForProject: (projectId: string) => Promise<SyncConfig | null>
  enableForProject: (connectionId: string, projectId: string) => Promise<SyncConfig | null>
  disableForProject: (projectId: string) => Promise<void>
  updateSyncConfig: (configId: string, updates: Partial<Pick<SyncConfig, 'target' | 'auto_sync' | 'sync_secrets' | 'sync_variables'>>) => Promise<void>
  triggerSync: (syncConfigId: string) => Promise<SyncResult>
  triggerSyncAllEnvs: (projectIntegrationId: string) => Promise<{ success: number; partial: number; failed: number; total: number }>
  fetchSyncHistory: (syncConfigId: string, limit?: number) => Promise<SyncHistoryEntry[]>
}

// =====================================================
// Factory Function
// =====================================================

/**
 * Creates a platform-specific integration composable (simplified)
 *
 * Organization-level connections only. Projects enable/disable via sync_configs.
 */
export function createPlatformIntegration(
  config: PlatformConfig,
  options: PlatformIntegrationOptions
): () => PlatformIntegration {
  return (): PlatformIntegration => {
    const client = useSupabaseClient<Database>()
    const { $toast } = useNuxtApp()

    // =====================================================
    // State
    // =====================================================

    const connection = ref<PlatformConnection | null>(null)
    const syncConfigs = ref<SyncConfig[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    // =====================================================
    // Computed
    // =====================================================

    const isConnected = computed(() => {
      return connection.value !== null && !connection.value.disconnected_at
    })

    // =====================================================
    // Methods
    // =====================================================

    /**
     * Fetch organization-level connection
     */
    const fetchOrgConnection = async (organizationId: string): Promise<PlatformConnection | null> => {
      loading.value = true
      error.value = null
      try {
        const { data, error: fetchError } = await client
          .from('platform_integrations')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('platform', config.id)
          .is('disconnected_at', null)
          .maybeSingle()

        if (fetchError) throw fetchError
        connection.value = data as PlatformConnection | null
        return data as PlatformConnection | null
      } catch (err) {
        console.error(`[use${config.name}Integration] Failed to fetch org connection:`, err)
        error.value = `Failed to load ${config.name} connection`
        return null
      } finally {
        loading.value = false
      }
    }

    /**
     * Get count of projects using this connection
     */
    const getDependentProjectCount = async (connectionId: string): Promise<number> => {
      try {
        const { count, error: fetchError } = await client
          .from('platform_sync_configs')
          .select('project_id', { count: 'exact', head: true })
          .eq('connection_id', connectionId)

        if (fetchError) throw fetchError
        return count ?? 0
      } catch (err) {
        console.error(`[use${config.name}Integration] Failed to count dependent projects:`, err)
        return 0
      }
    }

    const getDependentProjects = async (connectionId: string): Promise<Array<{ id: string; name: string }>> => {
      try {
        const { data, error: fetchError } = await client
          .from('platform_sync_configs')
          .select('project_id, projects!inner(id, name)')
          .eq('connection_id', connectionId)

        if (fetchError) throw fetchError

        return (data || []).flatMap((row) => {
          const projectData = row.projects
          if (!projectData) {
            return []
          }

          const project = Array.isArray(projectData) ? projectData[0] : projectData
          if (!project || typeof project.id !== 'string' || typeof project.name !== 'string') {
            return []
          }

          return [{ id: project.id, name: project.name }]
        })
      } catch (err) {
        console.error(`[use${config.name}Integration] Failed to fetch dependent projects:`, err)
        return []
      }
    }

    /**
     * Disconnect platform (mark connection as disconnected)
     * CASCADE will auto-delete all sync_configs
     */
    const disconnect = async (connectionId: string) => {
      loading.value = true

      try {
        const { error: updateError } = await client
          .from('platform_integrations')
          .update({ disconnected_at: new Date().toISOString() })
          .eq('id', connectionId)

        if (updateError) throw updateError

        connection.value = null
        syncConfigs.value = []
        $toast.success(`${config.name} disconnected`)
      } catch (err) {
        console.error(`[use${config.name}Integration] Disconnect failed:`, err)
        $toast.error(`Failed to disconnect ${config.name}`)
      } finally {
        loading.value = false
      }
    }

    /**
     * Fetch sync config for a specific project (if enabled)
     * Joins through connection to filter by platform
     */
    const fetchSyncConfigsForProject = async (projectId: string): Promise<SyncConfig | null> => {
      try {
        // We need to join through connection to filter by platform
        const { data, error: fetchError } = await client
          .from('platform_sync_configs')
          .select('*, connection:platform_integrations!inner(platform)')
          .eq('project_id', projectId)
          .eq('connection.platform', config.id)
          .maybeSingle()

        if (fetchError) throw fetchError

        if (data) {
          // Strip the join data for the SyncConfig type
          const { connection, ...syncConfig } = data
          syncConfigs.value = [syncConfig as SyncConfig]
          return syncConfig as SyncConfig
        } else {
          syncConfigs.value = []
        }

        return null
      } catch (err) {
        console.error(`[use${config.name}Integration] Failed to fetch sync config:`, err)
        return null
      }
    }

    /**
     * Enable integration for a project (create sync_config)
     */
    const enableForProject = async (connectionId: string, projectId: string): Promise<SyncConfig | null> => {
      loading.value = true
      error.value = null

      try {
        const { data, error: insertError } = await client
          .from('platform_sync_configs')
          .insert({
            connection_id: connectionId,
            project_id: projectId,
            auto_sync: false,
            sync_secrets: true,
            sync_variables: true,
            target: {}
          })
          .select()
          .single()

        if (insertError) throw insertError

        const syncConfig = data as SyncConfig
        syncConfigs.value = [syncConfig]
        $toast.success(`${config.name} enabled for this project`)
        return syncConfig
      } catch (err) {
        console.error(`[use${config.name}Integration] Failed to enable:`, err)
        $toast.error(`Failed to enable ${config.name}`)
        return null
      } finally {
        loading.value = false
      }
    }

    /**
     * Disable integration for a project (delete sync_config)
     * Uses the current sync config ID since we've already loaded it
     */
    const disableForProject = async (projectId: string) => {
      loading.value = true

      try {
        // Use the connection ID to filter - we know the connection is for this platform
        if (!connection.value) {
          throw new Error('No connection found')
        }

        const { error: deleteError } = await client
          .from('platform_sync_configs')
          .delete()
          .eq('project_id', projectId)
          .eq('connection_id', connection.value.id)

        if (deleteError) throw deleteError

        syncConfigs.value = []
        $toast.success(`${config.name} disabled for this project`)
      } catch (err) {
        console.error(`[use${config.name}Integration] Failed to disable:`, err)
        $toast.error(`Failed to disable ${config.name}`)
      } finally {
        loading.value = false
      }
    }

    /**
     * Update sync config settings
     */
    const updateSyncConfig = async (
      configId: string,
      updates: Partial<Pick<SyncConfig, 'target' | 'auto_sync' | 'sync_secrets' | 'sync_variables'>>
    ) => {
      loading.value = true

      try {
        const updatePayload: Database['public']['Tables']['platform_sync_configs']['Update'] = {}
        if (updates.target !== undefined) updatePayload.target = updates.target
        if (updates.auto_sync !== undefined) updatePayload.auto_sync = updates.auto_sync
        if (updates.sync_secrets !== undefined) updatePayload.sync_secrets = updates.sync_secrets
        if (updates.sync_variables !== undefined) updatePayload.sync_variables = updates.sync_variables

        const { error: updateError } = await client
          .from('platform_sync_configs')
          .update(updatePayload)
          .eq('id', configId)

        if (updateError) throw updateError

        $toast.success('Configuration saved')
      } catch (err) {
        console.error(`[use${config.name}Integration] Failed to update config:`, err)
        $toast.error('Failed to save configuration')
      } finally {
        loading.value = false
      }
    }

    /**
     * Trigger a manual sync to the platform
     */
    const triggerSync = async (syncConfigId: string): Promise<SyncResult> => {
      loading.value = true

      try {
        const { data, error: invokeError } = await client.functions.invoke(
          options.syncFunctionName,
          {
            body: {
              sync_config_id: syncConfigId,
              trigger_type: 'manual'
            }
          }
        )

        if (invokeError) throw invokeError

        const result = data as SyncResult

        if (result.status === 'partial') {
          $toast.warning(`Partial sync: ${result.variables_synced + result.secrets_synced} synced, ${result.errors?.length || 0} failed`)
        } else if (result.success) {
          $toast.success(`Synced ${result.variables_synced} variables and ${result.secrets_synced} secrets to ${config.name}`)
        } else {
          $toast.error(`Sync to ${config.name} failed. Check history for details.`)
        }

        return result
      } catch (err) {
        console.error(`[use${config.name}Integration] Sync failed:`, err)
        $toast.error(`Failed to sync to ${config.name}`)
        return {
          success: false,
          status: 'failed',
          variables_synced: 0,
          secrets_synced: 0,
          errors: [{ key: 'sync', error: err instanceof Error ? err.message : 'Unknown error' }]
        }
      } finally {
        loading.value = false
      }
    }

    /**
     * Trigger sync for ALL configured environments of an integration
     * v1.1: Manual sync from UI syncs all enabled environment configs
     */
    const triggerSyncAllEnvs = async (
      projectIntegrationId: string
    ): Promise<{ success: number; partial: number; failed: number; total: number }> => {
      loading.value = true

      try {
        // Get all enabled environment configs for this integration
        const { data: envConfigs, error: fetchError } = await client
          .from('environment_integration_configs')
          .select('id, environment_id')
          .eq('project_integration_id', projectIntegrationId)
          .eq('enabled', true)

        if (fetchError) throw fetchError

        if (!envConfigs || envConfigs.length === 0) {
          $toast.warning('No environments configured for this integration')
          return { success: 0, partial: 0, failed: 0, total: 0 }
        }

        let success = 0
        let partial = 0
        let failed = 0

        // Sync each environment config
        for (const envConfig of envConfigs) {
          try {
            const { data, error: invokeError } = await client.functions.invoke(
              options.syncFunctionName,
              {
                body: {
                  env_config_id: envConfig.id,
                  trigger_type: 'manual'
                }
              }
            )

            if (invokeError) {
              failed++
              console.error(`[use${config.name}Integration] Sync failed for env config ${envConfig.id}:`, invokeError)
            } else if (data?.status === 'partial') {
              partial++
            } else if (data?.success === false || data?.status === 'failed') {
              failed++
            } else {
              success++
            }
          } catch (err) {
            failed++
            console.error(`[use${config.name}Integration] Sync exception for env config ${envConfig.id}:`, err)
          }
        }

        // Summary toast
        const total = envConfigs.length
        if (failed === 0 && partial === 0) {
          $toast.success(`Synced ${success} environment${success !== 1 ? 's' : ''} to ${config.name}`)
        } else if (success === 0 && partial === 0) {
          $toast.error(`All ${failed} environment syncs failed`)
        } else {
          $toast.warning(`Sync result: ${success} success, ${partial} partial, ${failed} failed (${total} total)`)
        }

        return { success, partial, failed, total }
      } catch (err) {
        console.error(`[use${config.name}Integration] Sync all failed:`, err)
        $toast.error(`Failed to sync to ${config.name}`)
        return { success: 0, partial: 0, failed: 0, total: 0 }
      } finally {
        loading.value = false
      }
    }

    /**
     * Fetch sync history for all environment configs of a project integration
     * v1.1: History is now per-environment, so we fetch all env configs and their history
     */
    const fetchSyncHistory = async (projectIntegrationId: string, limit = 10): Promise<SyncHistoryEntry[]> => {
      try {
        // First get all environment config IDs for this project integration
        const { data: envConfigs, error: envError } = await client
          .from('environment_integration_configs')
          .select('id')
          .eq('project_integration_id', projectIntegrationId)

        if (envError) throw envError

        if (!envConfigs || envConfigs.length === 0) {
          return []
        }

        const envConfigIds = envConfigs.map(c => c.id)

        // Fetch history for all environment configs (column is now env_config_id)
        const { data, error: fetchError } = await client
          .from('platform_sync_history')
          .select('*')
          .in('env_config_id', envConfigIds)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (fetchError) throw fetchError
        return (data as SyncHistoryEntry[]) || []
      } catch (err) {
        console.error(`[use${config.name}Integration] Failed to fetch history:`, err)
        return []
      }
    }

    // =====================================================
    // Return Public API
    // =====================================================

    return {
      // State
      connection,
      syncConfigs,
      loading,
      error,

      // Computed
      isConnected,

      // Methods
      fetchOrgConnection,
      getDependentProjects,
      getDependentProjectCount,
      disconnect,
      fetchSyncConfigsForProject,
      enableForProject,
      disableForProject,
      updateSyncConfig,
      triggerSync,
      triggerSyncAllEnvs,
      fetchSyncHistory
    } as unknown as PlatformIntegration
  }
}
