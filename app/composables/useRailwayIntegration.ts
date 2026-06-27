// =====================================================
// Railway Integration Composable
// =====================================================
// Railway-specific integration using the platform factory
// Handles connection, validation, project/service listing, and sync

import { createPlatformIntegration } from './usePlatformIntegration'
import type { PlatformConfig } from '~/types/integration.types'
import type { Database, Json } from '~/types/database.types'

// =====================================================
// Railway Platform Config
// =====================================================

export const RAILWAY_CONFIG: PlatformConfig = {
  id: 'railway',
  name: 'Railway',
  icon: 'simple-icons:railway',
  color: '#0B0D0E',
  description: 'Sync environment variables to Railway services',
  supportsInstanceUrl: false,
  supportsSkipSsl: false
}

// =====================================================
// Railway-Specific Types
// =====================================================

export interface RailwayUser {
  id: string
  email: string
  name: string | null
  isVerified: boolean
}

export interface RailwayWorkspace {
  id: string
  name: string
}

export interface RailwayProject {
  id: string
  name: string
  services: Array<{ id: string; name: string }>
  environments: Array<{ id: string; name: string }>
}

export interface RailwayValidationResult {
  valid: boolean
  user?: RailwayUser
  workspaces?: RailwayWorkspace[]
  error?: string
}

export interface RailwaySyncTarget {
  project_id: string
  project_name: string
  workspace_id: string
  service_id: string | null  // null = shared variables
  service_name: string | null
  environment_mapping: Array<{
    envmanager_env: string
    railway_env_id: string
    railway_env_name: string
  }>
}

// =====================================================
// Create Composable via Factory
// =====================================================

const basePlatformIntegration = createPlatformIntegration(
  RAILWAY_CONFIG,
  { syncFunctionName: 'railway-sync' }
)

// =====================================================
// Extended Railway Composable
// =====================================================

export function useRailwayIntegration() {
  const base = basePlatformIntegration()
  const client = useSupabaseClient<Database>()
  const { $toast } = useNuxtApp()

  // Additional Railway-specific state
  const validating = ref(false)
  const validationResult = ref<RailwayValidationResult | null>(null)
  const projects = ref<RailwayProject[]>([])
  const loadingProjects = ref(false)

  /**
   * Validate a Railway API token
   * @param token - Railway API token
   */
  const validateToken = async (token: string): Promise<RailwayValidationResult> => {
    validating.value = true
    validationResult.value = null

    try {
      const { data, error } = await client.functions.invoke('railway-validate', {
        body: { token }
      })

      if (error) throw error

      validationResult.value = data as RailwayValidationResult
      return validationResult.value

    } catch (err) {
      console.error('[useRailwayIntegration] Validation failed:', err)
      const result: RailwayValidationResult = {
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
   * Connect Railway account (save token and create connection)
   * Uses create_platform_integration RPC
   * @param organizationId - Organization to connect to
   * @param token - Railway API token
   * @param name - User-defined connection name
   * @param workspaceId - Optional workspace ID to store in metadata
   */
  const connect = async (
    organizationId: string,
    token: string,
    name: string,
    workspaceId?: string
  ): Promise<boolean> => {
    base.loading.value = true

    try {
      // Store token in Vault and create connection using RPC
      const { data: integrationId, error } = await client.rpc('create_platform_integration', {
        p_organization_id: organizationId,
        p_platform: 'railway',
        p_name: name,
        p_api_token: token
      })

      if (error) throw error

      // If workspace ID provided, update metadata
      if (workspaceId && integrationId) {
        const { error: updateError } = await client
          .from('platform_integrations')
          .update({ metadata: { workspaceId } })
          .eq('id', integrationId)

        if (updateError) {
          console.error('[useRailwayIntegration] Failed to store workspace ID:', updateError)
          // Non-fatal - connection still works, just won't have default workspace
        }
      }

      // Refresh connection
      await base.fetchOrgConnection(organizationId)
      $toast.success('Railway connected successfully')
      return true

    } catch (err) {
      console.error('[useRailwayIntegration] Connect failed:', err)
      $toast.error('Failed to connect Railway')
      return false
    } finally {
      base.loading.value = false
    }
  }

  /**
   * List Railway projects for a workspace
   */
  const listResources = async (
    connectionId: string,
    workspaceId?: string
  ): Promise<{ projects: RailwayProject[] }> => {
    loadingProjects.value = true
    projects.value = []

    try {
      const { data, error } = await client.functions.invoke('railway-list-resources', {
        body: { connection_id: connectionId, workspace_id: workspaceId }
      })

      if (error) throw error

      projects.value = data.projects || []
      return { projects: projects.value }

    } catch (err) {
      console.error('[useRailwayIntegration] List resources failed:', err)
      $toast.error('Failed to load Railway projects')
      return { projects: [] }
    } finally {
      loadingProjects.value = false
    }
  }

  /**
   * Create or update sync config with Railway target (one per project)
   */
  const configureSyncTarget = async (
    connectionId: string,
    projectId: string,
    target: RailwaySyncTarget,
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
      console.error('[useRailwayIntegration] Configure failed:', err)
      $toast.error('Failed to save configuration')
      return false
    }
  }

  return {
    // From base
    ...base,

    // Railway-specific state
    validating,
    validationResult,
    projects,
    loadingProjects,

    // Railway-specific methods
    validateToken,
    connect,
    listResources,
    configureSyncTarget
  }
}
