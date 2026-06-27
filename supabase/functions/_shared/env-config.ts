/**
 * Environment integration config lookup utilities.
 * Replaces old platform_sync_configs.target.environment_mapping pattern.
 */

export interface EnvironmentSyncConfig {
  id: string
  environment_id: string
  project_integration_id: string
  target_config: Record<string, unknown>
  prefix: string | null
  enabled: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
  integration: {
    id: string
    platform: string
    instance_url: string | null
    skip_ssl_verify: boolean
    api_token_vault_id: string
    ca_cert_vault_id: string | null
    disconnected_at: string | null
    connected_by: string
  }
}

/**
 * Fetch environment config for a specific environment and integration.
 * Returns null if no config exists (environment not configured).
 */
export async function getEnvironmentConfig(
  client: any,
  environmentId: string,
  projectIntegrationId: string
): Promise<{ data: EnvironmentSyncConfig | null; error: string | null }> {
  const { data, error } = await client
    .from('environment_integration_configs')
    .select(`
      *,
      integration:platform_integrations!project_integration_id(
        id,
        platform,
        instance_url,
        skip_ssl_verify,
        api_token_vault_id,
        ca_cert_vault_id,
        disconnected_at,
        connected_by
      )
    `)
    .eq('environment_id', environmentId)
    .eq('project_integration_id', projectIntegrationId)
    .eq('enabled', true)
    .maybeSingle()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

/**
 * Fetch all enabled environment configs for an integration.
 * Used for bulk sync operations.
 */
export async function getAllEnvironmentConfigs(
  client: any,
  projectIntegrationId: string
): Promise<{ data: EnvironmentSyncConfig[]; error: string | null }> {
  const { data, error } = await client
    .from('environment_integration_configs')
    .select(`
      *,
      integration:platform_integrations!project_integration_id(
        id,
        platform,
        instance_url,
        skip_ssl_verify,
        api_token_vault_id,
        ca_cert_vault_id,
        disconnected_at,
        connected_by
      )
    `)
    .eq('project_integration_id', projectIntegrationId)
    .eq('enabled', true)

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}
