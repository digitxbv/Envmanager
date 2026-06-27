import type { Database } from '~/types/database.types'

type EnvironmentIntegrationConfig = Database['public']['Tables']['environment_integration_configs']['Row']
type EnvironmentIntegrationConfigInsert = Database['public']['Tables']['environment_integration_configs']['Insert']

export interface UpsertConfig {
  environment_id: string
  target_config: Record<string, unknown>
  prefix: string | null
  enabled?: boolean
  service_id?: string | null
}

export function useEnvironmentIntegrationConfig() {
  const supabase = useSupabaseClient<Database>()

  const configs = ref<EnvironmentIntegrationConfig[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch all environment configs for a project integration
   */
  async function getConfigsForIntegration(projectIntegrationId: string): Promise<{ data: EnvironmentIntegrationConfig[] | null; error: string | null }> {
    loading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await supabase
        .from('environment_integration_configs')
        .select('*')
        .eq('project_integration_id', projectIntegrationId)
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
   * Uses manual fetch-then-insert/update to work with partial unique indexes
   * (service_id IS NULL vs service_id IS NOT NULL have separate indexes)
   */
  async function upsertConfig(projectIntegrationId: string, config: UpsertConfig): Promise<{ data: EnvironmentIntegrationConfig | null; error: string | null }> {
    loading.value = true
    error.value = null

    try {
      // Find existing config matching the composite key
      let query = supabase
        .from('environment_integration_configs')
        .select('*')
        .eq('environment_id', config.environment_id)
        .eq('project_integration_id', projectIntegrationId)

      if (config.service_id) {
        query = query.eq('service_id', config.service_id)
      } else {
        query = query.is('service_id', null)
      }

      const { data: existing } = await query.maybeSingle()

      let result: EnvironmentIntegrationConfig | null = null

      if (existing) {
        // Update existing
        const { data, error: updateError } = await supabase
          .from('environment_integration_configs')
          .update({
            target_config: config.target_config as EnvironmentIntegrationConfigInsert['target_config'],
            prefix: config.prefix,
            enabled: config.enabled ?? true
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (updateError) throw updateError
        result = data as EnvironmentIntegrationConfig
      } else {
        // Insert new
        const { data, error: insertError } = await supabase
          .from('environment_integration_configs')
          .insert({
            project_integration_id: projectIntegrationId,
            environment_id: config.environment_id,
            target_config: config.target_config as EnvironmentIntegrationConfigInsert['target_config'],
            prefix: config.prefix,
            enabled: config.enabled ?? true,
            service_id: config.service_id ?? null
          })
          .select()
          .single()

        if (insertError) throw insertError
        result = data as EnvironmentIntegrationConfig
      }

      if (result) {
        await getConfigsForIntegration(projectIntegrationId)
        return { data: result, error: null }
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
        .from('environment_integration_configs')
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
   * Uses manual fetch-then-insert/update per config to work with partial unique indexes
   */
  async function bulkUpsertConfigs(projectIntegrationId: string, configsList: UpsertConfig[]): Promise<{ data: EnvironmentIntegrationConfig[] | null; error: string | null }> {
    loading.value = true
    error.value = null

    try {
      const results: EnvironmentIntegrationConfig[] = []

      for (const config of configsList) {
        // Find existing config matching the composite key
        let query = supabase
          .from('environment_integration_configs')
          .select('*')
          .eq('environment_id', config.environment_id)
          .eq('project_integration_id', projectIntegrationId)

        if (config.service_id) {
          query = query.eq('service_id', config.service_id)
        } else {
          query = query.is('service_id', null)
        }

        const { data: existing } = await query.maybeSingle()

        if (existing) {
          // Update existing
          const { data, error: updateError } = await supabase
            .from('environment_integration_configs')
            .update({
              target_config: config.target_config as EnvironmentIntegrationConfigInsert['target_config'],
              prefix: config.prefix,
              enabled: config.enabled ?? true
            })
            .eq('id', existing.id)
            .select()
            .single()

          if (updateError) throw updateError
          if (data) results.push(data as EnvironmentIntegrationConfig)
        } else {
          // Insert new
          const { data, error: insertError } = await supabase
            .from('environment_integration_configs')
            .insert({
              project_integration_id: projectIntegrationId,
              environment_id: config.environment_id,
              target_config: config.target_config as EnvironmentIntegrationConfigInsert['target_config'],
              prefix: config.prefix,
              enabled: config.enabled ?? true,
              service_id: config.service_id ?? null
            })
            .select()
            .single()

          if (insertError) throw insertError
          if (data) results.push(data as EnvironmentIntegrationConfig)
        }
      }

      // Update local state
      configs.value = results

      return { data: results, error: null }
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
    getConfigsForIntegration,
    upsertConfig,
    deleteConfig,
    bulkUpsertConfigs
  }
}
