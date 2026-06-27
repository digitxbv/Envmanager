// =====================================================
// Dokploy Integration Composable
// =====================================================
// Dokploy-specific integration using the platform factory
// Handles self-hosted instance URL, SSL certs, validation, and sync

import { createPlatformIntegration } from './usePlatformIntegration'
import type { PlatformConfig } from '~/types/integration.types'
import type { Database, Json } from '~/types/database.types'

// =====================================================
// Dokploy Platform Config
// =====================================================

export const DOKPLOY_CONFIG: PlatformConfig = {
  id: 'dokploy',
  name: 'Dokploy',
  icon: 'simple-icons:docker',  // Dokploy doesn't have its own icon, use docker
  color: '#2496ED',             // Docker blue
  description: 'Sync environment variables to self-hosted Dokploy instances',
  supportsInstanceUrl: true,    // Key difference from Vercel/Railway
  supportsSkipSsl: true         // For self-signed certs
}

// =====================================================
// Dokploy-Specific Types
// =====================================================

export interface DokployUser {
  id: string
  email: string
  name: string
}

export interface DokployValidationResult {
  valid: boolean
  user?: DokployUser
  error?: string
}

export interface DokployProject {
  id: string
  name: string
  services: DokployService[]
}

export type DokployServiceType = 'application' | 'compose' | 'mariadb' | 'mongo' | 'mysql' | 'postgres' | 'redis'

export interface DokployService {
  id: string
  name: string
  appName: string
  status: string
  type: DokployServiceType
}

export interface DokploySyncTarget {
  project_id: string
  project_name: string
  service_id: string
  service_name: string
  service_type: DokployServiceType
  environment_mapping: Array<{
    envmanager_env: string
  }>
}

// =====================================================
// Create Composable via Factory
// =====================================================

const basePlatformIntegration = createPlatformIntegration(
  DOKPLOY_CONFIG,
  { syncFunctionName: 'dokploy-sync' }
)

// =====================================================
// Extended Dokploy Composable
// =====================================================

export function useDokployIntegration() {
  const base = basePlatformIntegration()
  const client = useSupabaseClient<Database>()
  const { $toast } = useNuxtApp()

  // Additional Dokploy-specific state
  const validating = ref(false)
  const validationResult = ref<DokployValidationResult | null>(null)
  const projects = ref<DokployProject[]>([])
  const loadingProjects = ref(false)

  /**
   * Validate a Dokploy API token against a self-hosted instance
   * @param instanceUrl - Dokploy instance URL (e.g., https://dokploy.example.com)
   * @param token - Dokploy API token
   * @param caCert - Optional CA certificate for self-signed SSL
   */
  const validateToken = async (
    instanceUrl: string,
    token: string,
    caCert?: string
  ): Promise<DokployValidationResult> => {
    validating.value = true
    validationResult.value = null

    try {
      const { data, error } = await client.functions.invoke('dokploy-validate', {
        body: { instance_url: instanceUrl, token, ca_cert: caCert }
      })

      if (error) throw error

      validationResult.value = data as DokployValidationResult
      return validationResult.value

    } catch (err) {
      console.error('[useDokployIntegration] Validation failed:', err)
      const result: DokployValidationResult = {
        valid: false,
        error: err instanceof Error ? err.message : 'Validation failed'
      }
      validationResult.value = result
      return result
    } finally {
      validating.value = false
    }
  }

  /**
   * Connect Dokploy account (save token and create connection)
   * Uses create_platform_integration RPC with instance_url column
   * @param organizationId - Organization to connect to
   * @param instanceUrl - Dokploy instance URL
   * @param token - Dokploy API token
   * @param name - User-defined connection name
   * @param caCert - Optional CA certificate for self-signed SSL
   */
  const connect = async (
    organizationId: string,
    instanceUrl: string,
    token: string,
    name: string,
    caCert?: string
  ): Promise<boolean> => {
    base.loading.value = true

    try {
      // Store token in Vault and create connection using RPC
      // instance_url is stored in dedicated column
      const { data: integrationId, error } = await client.rpc('create_platform_integration', {
        p_organization_id: organizationId,
        p_platform: 'dokploy',
        p_name: name,
        p_api_token: token,
        p_instance_url: instanceUrl,
        p_ca_cert: caCert ?? undefined
      })

      if (error) throw error

      // Refresh connection
      await base.fetchOrgConnection(organizationId)
      $toast.success('Dokploy connected successfully')
      return true

    } catch (err) {
      console.error('[useDokployIntegration] Connect failed:', err)
      $toast.error('Failed to connect Dokploy')
      return false
    } finally {
      base.loading.value = false
    }
  }

  /**
   * List Dokploy projects and applications
   */
  const listResources = async (
    connectionId: string
  ): Promise<{ projects: DokployProject[] }> => {
    loadingProjects.value = true
    projects.value = []

    try {
      const { data, error } = await client.functions.invoke('dokploy-list-resources', {
        body: { connection_id: connectionId }
      })

      if (error) throw error

      projects.value = data.projects || []
      return { projects: projects.value }

    } catch (err) {
      console.error('[useDokployIntegration] List resources failed:', err)
      $toast.error('Failed to load Dokploy projects')
      return { projects: [] }
    } finally {
      loadingProjects.value = false
    }
  }

  /**
   * Create or update sync config with Dokploy target (one per project)
   */
  const configureSyncTarget = async (
    connectionId: string,
    projectId: string,
    target: DokploySyncTarget,
    options: { autoSync?: boolean; syncSecrets?: boolean; syncVariables?: boolean } = {}
  ): Promise<boolean> => {
    try {
      const { error } = await client
        .from('platform_sync_configs')
        .upsert({
          connection_id: connectionId,
          project_id: projectId,
          target: target as unknown as Json,
          auto_sync: options.autoSync ?? false,
          sync_secrets: options.syncSecrets ?? true,
          sync_variables: options.syncVariables ?? true
        }, {
          onConflict: 'connection_id,project_id'
        })

      if (error) throw error

      $toast.success('Sync configuration saved')
      return true

    } catch (err) {
      console.error('[useDokployIntegration] Configure failed:', err)
      $toast.error('Failed to save configuration')
      return false
    }
  }

  return {
    // From base
    ...base,

    // Dokploy-specific state
    validating,
    validationResult,
    projects,
    loadingProjects,

    // Dokploy-specific methods
    validateToken,
    connect,
    listResources,
    configureSyncTarget
  }
}
