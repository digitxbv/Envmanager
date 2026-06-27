// =====================================================
// GitHub Environment Config Composable
// =====================================================
// Manages per-environment GitHub sync configurations
// Mirrors useEnvironmentIntegrationConfig but for GitHub's OAuth-based auth

import type { Database, Json } from '~/types/database.types'

type GitHubEnvironmentConfig = Database['public']['Tables']['github_environment_configs']['Row']
type GitHubEnvironmentConfigInsert = Database['public']['Tables']['github_environment_configs']['Insert']

export interface GitHubTargetConfig {
  sync_level: 'repository' | 'environment' | 'organization'
  repo_owner: string | null
  repo_name: string | null
  github_environment: string | null
  github_org_visibility?: 'all' | 'private'
  auto_sync?: boolean
  sync_secrets?: boolean
  sync_variables?: boolean
}

export interface GitHubEnvConfigInput {
  environment_id: string
  target_config: GitHubTargetConfig
  prefix: string | null
  enabled?: boolean
}

const toJsonTargetConfig = (value: GitHubTargetConfig): Json => {
  return value as unknown as Json
}

export function useGitHubEnvironmentConfig() {
  const supabase = useSupabaseClient<Database>()

  const configs = ref<GitHubEnvironmentConfig[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch all environment configs for a project sync config
   */
  async function getConfigsForProjectSync(projectSyncConfigId: string): Promise<{ data: GitHubEnvironmentConfig[] | null; error: string | null }> {
    loading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await supabase
        .from('github_environment_configs')
        .select('*')
        .eq('project_sync_config_id', projectSyncConfigId)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      configs.value = data || []
      return { data: data || [], error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch configs'
      error.value = errorMessage
      return { data: null, error: errorMessage }
    } finally {
      loading.value = false
    }
  }

  /**
   * Upsert a single environment config
   */
  async function upsertConfig(projectSyncConfigId: string, config: GitHubEnvConfigInput): Promise<{ data: GitHubEnvironmentConfig | null; error: string | null }> {
    loading.value = true
    error.value = null

    try {
      const payload: GitHubEnvironmentConfigInsert = {
        project_sync_config_id: projectSyncConfigId,
        environment_id: config.environment_id,
        target_config: toJsonTargetConfig(config.target_config),
        prefix: config.prefix,
        enabled: config.enabled ?? true
      }

      const { data, error: upsertError } = await supabase
        .from('github_environment_configs')
        .upsert(payload, {
          onConflict: 'project_sync_config_id,environment_id'
        })
        .select()
        .single()

      if (upsertError) throw upsertError

      if (data) {
        const row = data as GitHubEnvironmentConfig
        await getConfigsForProjectSync(projectSyncConfigId)

        return { data: row, error: null }
      }

      return { data: null, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upsert config'
      error.value = errorMessage
      return { data: null, error: errorMessage }
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete an environment config by ID
   */
  async function deleteConfig(configId: string): Promise<{ error: string | null }> {
    loading.value = true
    error.value = null

    try {
      const { error: deleteError } = await supabase
        .from('github_environment_configs')
        .delete()
        .eq('id', configId)

      if (deleteError) throw deleteError

      const index = configs.value.findIndex(c => c.id === configId)
      if (index >= 0) {
        configs.value.splice(index, 1)
      }
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete config'
      error.value = errorMessage
      return { error: errorMessage }
    } finally {
      loading.value = false
    }
  }

  /**
   * Bulk upsert multiple environment configs
   */
  async function bulkUpsertConfigs(projectSyncConfigId: string, configsList: GitHubEnvConfigInput[]): Promise<{ data: GitHubEnvironmentConfig[] | null; error: string | null }> {
    loading.value = true
    error.value = null

    try {
      const payloads: GitHubEnvironmentConfigInsert[] = configsList.map(config => ({
        project_sync_config_id: projectSyncConfigId,
        environment_id: config.environment_id,
        target_config: toJsonTargetConfig(config.target_config),
        prefix: config.prefix,
        enabled: config.enabled ?? true
      }))

      const { data, error: upsertError } = await supabase
        .from('github_environment_configs')
        .upsert(payloads, {
          onConflict: 'project_sync_config_id,environment_id'
        })
        .select()

      if (upsertError) throw upsertError

      if (data) {
        configs.value = data
      }

      return { data: data || [], error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bulk upsert configs'
      error.value = errorMessage
      return { data: null, error: errorMessage }
    } finally {
      loading.value = false
    }
  }

  return {
    configs: readonly(configs),
    loading: readonly(loading),
    error: readonly(error),
    getConfigsForProjectSync,
    upsertConfig,
    deleteConfig,
    bulkUpsertConfigs
  }
}
