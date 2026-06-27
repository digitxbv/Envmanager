// =====================================================
// Coolify Integration Composable
// =====================================================
// Coolify-specific integration using the platform factory
// Handles self-hosted instance URL, SSL certs, validation, and sync

import { createPlatformIntegration } from './usePlatformIntegration'
import type { PlatformConfig } from '~/types/integration.types'
import type { Database, Json } from '~/types/database.types'

// =====================================================
// Coolify Platform Config
// =====================================================

export const COOLIFY_CONFIG: PlatformConfig = {
  id: 'coolify',
  name: 'Coolify',
  icon: 'simple-icons:docker',  // Same as Dokploy per CONTEXT.md
  color: '#2496ED',             // Docker blue
  description: 'Sync environment variables to self-hosted Coolify instances',
  supportsInstanceUrl: true,    // Key difference from Vercel/Railway
  supportsSkipSsl: true         // For self-signed certs
}

// =====================================================
// Coolify-Specific Types
// =====================================================

export interface CoolifyValidationResult {
  valid: boolean
  error?: string
}

export interface CoolifyApplication {
  uuid: string
  name: string
  description: string
  status: string
  fqdn: string
}

export interface CoolifyDatabase {
  uuid: string
  name: string
  type: string
  status: string
}

export interface CoolifyService {
  uuid: string
  name: string
  description: string
  status: string
}

export type CoolifyResourceType = 'application' | 'database' | 'service'

export interface CoolifySyncTarget {
  resource_uuid: string
  resource_name: string
  resource_type: CoolifyResourceType
  include_build_vars: boolean
  environment_mapping: Array<{
    envmanager_env: string
  }>
}

// =====================================================
// Create Composable via Factory
// =====================================================

const basePlatformIntegration = createPlatformIntegration(
  COOLIFY_CONFIG,
  { syncFunctionName: 'coolify-sync' }
)

// =====================================================
// Extended Coolify Composable
// =====================================================

export function useCoolifyIntegration() {
  const base = basePlatformIntegration()
  const client = useSupabaseClient<Database>()
  const { $toast } = useNuxtApp()

  // Additional Coolify-specific state
  const validating = ref(false)
  const validationResult = ref<CoolifyValidationResult | null>(null)
  const applications = ref<CoolifyApplication[]>([])
  const databases = ref<CoolifyDatabase[]>([])
  const services = ref<CoolifyService[]>([])
  const loadingResources = ref(false)

  /**
   * Validate a Coolify API token against a self-hosted instance
   * @param instanceUrl - Coolify instance URL (e.g., https://coolify.example.com)
   * @param token - Coolify API token
   * @param caCert - Optional CA certificate for self-signed SSL
   */
  const validateToken = async (
    instanceUrl: string,
    token: string,
    caCert?: string
  ): Promise<CoolifyValidationResult> => {
    validating.value = true
    validationResult.value = null

    try {
      const { data, error } = await client.functions.invoke('coolify-validate', {
        body: { instance_url: instanceUrl, token, ca_cert: caCert }
      })

      if (error) throw error

      validationResult.value = data as CoolifyValidationResult
      return validationResult.value

    } catch (err) {
      console.error('[useCoolifyIntegration] Validation failed:', err)
      const result: CoolifyValidationResult = {
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
   * Connect Coolify account (save token and create connection)
   * Uses create_platform_integration RPC with instance_url column
   * @param organizationId - Organization to connect to
   * @param instanceUrl - Coolify instance URL
   * @param token - Coolify API token
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
        p_platform: 'coolify',
        p_name: name,
        p_api_token: token,
        p_instance_url: instanceUrl,
        p_ca_cert: caCert ?? undefined
      })

      if (error) throw error

      // Refresh connection
      await base.fetchOrgConnection(organizationId)
      $toast.success('Coolify connected successfully')
      return true

    } catch (err) {
      console.error('[useCoolifyIntegration] Connect failed:', err)
      $toast.error('Failed to connect Coolify')
      return false
    } finally {
      base.loading.value = false
    }
  }

  /**
   * List Coolify resources (applications, databases, services)
   */
  const listResources = async (
    connectionId: string
  ): Promise<{ applications: CoolifyApplication[]; databases: CoolifyDatabase[]; services: CoolifyService[] }> => {
    loadingResources.value = true
    applications.value = []
    databases.value = []
    services.value = []

    try {
      const { data, error } = await client.functions.invoke('coolify-list-resources', {
        body: { connection_id: connectionId }
      })

      if (error) throw error

      applications.value = data.applications || []
      databases.value = data.databases || []
      services.value = data.services || []
      return {
        applications: applications.value,
        databases: databases.value,
        services: services.value
      }

    } catch (err) {
      console.error('[useCoolifyIntegration] List resources failed:', err)
      $toast.error('Failed to load Coolify resources')
      return { applications: [], databases: [], services: [] }
    } finally {
      loadingResources.value = false
    }
  }

  /**
   * Create or update sync config with Coolify target (one per project)
   */
  const configureSyncTarget = async (
    connectionId: string,
    projectId: string,
    target: CoolifySyncTarget,
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
      console.error('[useCoolifyIntegration] Configure failed:', err)
      $toast.error('Failed to save configuration')
      return false
    }
  }

  return {
    // From base
    ...base,

    // Coolify-specific state
    validating,
    validationResult,
    applications,
    databases,
    services,
    loadingResources,

    // Coolify-specific methods
    validateToken,
    connect,
    listResources,
    configureSyncTarget
  }
}
