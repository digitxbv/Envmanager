/**
 * useAutoSync - Triggers automatic syncs after variable changes
 *
 * When auto_sync is enabled on platform or GitHub sync configs,
 * this composable triggers those syncs directly from the UI
 * after variable save/update/delete operations.
 *
 * v1.1 Update: Uses environment_integration_configs for per-env targeting
 * while checking platform_sync_configs.auto_sync for the trigger flag.
 */
export function useAutoSync() {
  const client = useSupabaseClient()
  type SyncInvokeResult = {
    success?: boolean
    status?: 'success' | 'partial' | 'failed'
  }

  /**
   * Trigger all auto-syncs for an environment
   * Runs in background - doesn't block UI
   */
  async function triggerAutoSyncs(environmentId: string) {
    if (!environmentId) return

    try {
      // Get environment with its project to find related sync configs
      const { data: environment } = await client
        .from('environments')
        .select('project_id')
        .eq('id', environmentId)
        .single()

      if (!environment) return

      // Get all enabled environment configs for this environment
      const { data: envConfigs } = await client
        .from('environment_integration_configs')
        .select(`
          id,
          project_integration_id,
          enabled,
          integration:platform_integrations!project_integration_id(
            id,
            platform
          )
        `)
        .eq('environment_id', environmentId)
        .eq('enabled', true)

      // Get platform_sync_configs that have auto_sync enabled for this project
      const { data: syncConfigs } = await client
        .from('platform_sync_configs')
        .select('connection_id, auto_sync')
        .eq('project_id', environment.project_id)
        .eq('auto_sync', true)

      // Build a Set of connection_ids that have auto_sync enabled
      const autoSyncEnabledConnectionIds = new Set(
        (syncConfigs || []).map(c => c.connection_id)
      )

      const promises: Promise<void>[] = []

      // Queue platform syncs for each configured env integration WHERE auto_sync is enabled
      for (const config of envConfigs || []) {
        // Skip if auto_sync is not enabled for this integration
        if (!autoSyncEnabledConnectionIds.has(config.project_integration_id)) {
          continue
        }

        const platform = (config.integration as any)?.platform
        if (platform) {
          promises.push(callPlatformSync(config.id, platform))
        }
      }

      // Get GitHub environment configs and check project-level auto_sync
      const { data: githubConfigs } = await client
        .from('github_environment_configs')
        .select(`
          id,
          project_sync_config:github_project_sync_configs(auto_sync)
        `)
        .eq('environment_id', environmentId)
        .eq('enabled', true)

      // Queue GitHub syncs where auto_sync is enabled
      for (const config of githubConfigs || []) {
        const autoSyncEnabled = (config.project_sync_config as { auto_sync: boolean } | null)?.auto_sync
        if (autoSyncEnabled) {
          promises.push(callGitHubSync(config.id))
        }
      }

      if (promises.length === 0) return

      // Fire and forget - don't block the UI
      Promise.allSettled(promises).then(results => {
        const failures = results.filter(r => r.status === 'rejected')
        if (failures.length > 0) {
          console.warn(`[auto-sync] ${failures.length} sync(s) failed:`, failures)
        }
      })
    } catch (error) {
      // Don't block UI on auto-sync errors
      console.error('[auto-sync] Failed to trigger syncs:', error)
    }
  }

  /**
   * Call platform sync edge function (Vercel, Railway, Render, etc.)
   * Now uses env_config_id instead of sync_config_id
   */
  async function callPlatformSync(envConfigId: string, platform: string): Promise<void> {
    const functionName = `${platform}-sync`

    const { data, error } = await client.functions.invoke(functionName, {
      body: {
        env_config_id: envConfigId,
        trigger_type: 'auto'
      }
    })

    if (error) {
      console.warn(`[auto-sync] ${platform} sync failed for ${envConfigId}:`, error)
      throw error
    }

    const result = data as SyncInvokeResult | null
    if (result?.status === 'failed' || result?.success === false) {
      throw new Error(`${platform} sync returned failed status`)
    }
    if (result?.status === 'partial') {
      console.warn(`[auto-sync] ${platform} sync partial for ${envConfigId}`)
    }
  }

  /**
   * Call GitHub sync edge function
   */
  async function callGitHubSync(envConfigId: string): Promise<void> {
    const { data, error } = await client.functions.invoke('github-sync', {
      body: {
        env_config_id: envConfigId,
        trigger_type: 'auto'
      }
    })

    if (error) {
      console.warn(`[auto-sync] GitHub sync failed for ${envConfigId}:`, error)
      throw error
    }

    const result = data as SyncInvokeResult | null
    if (result?.status === 'failed' || result?.success === false) {
      throw new Error('GitHub sync returned failed status')
    }
    if (result?.status === 'partial') {
      console.warn(`[auto-sync] GitHub sync partial for ${envConfigId}`)
    }
  }

  return { triggerAutoSyncs }
}
