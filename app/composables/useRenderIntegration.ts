// =====================================================
// Render Integration Composable
// =====================================================
// Render-specific integration using the platform factory
// Handles connection, validation, service/env group listing, and sync

import { createPlatformIntegration } from './usePlatformIntegration'
import type { PlatformConfig } from '~/types/integration.types'
import type { Database, Json } from '~/types/database.types'

// =====================================================
// Render Platform Config
// =====================================================

export const RENDER_CONFIG: PlatformConfig = {
  id: 'render',
  name: 'Render',
  icon: 'simple-icons:render',
  color: '#46E3B7',
  description: 'Sync environment variables to Render services and env groups',
  supportsInstanceUrl: false,
  supportsSkipSsl: false
}

// =====================================================
// Render-Specific Types
// =====================================================

export interface RenderOwner {
  id: string
  name: string
  type: 'user' | 'team'
}

export interface RenderService {
  id: string
  name: string
  type: string  // web, private, background, cron, static
}

export interface RenderEnvGroup {
  id: string
  name: string
}

export interface RenderValidationResult {
  valid: boolean
  owners?: RenderOwner[]
  error?: string
}

export interface RenderSyncTarget {
  owner_id: string
  owner_name: string
  target_type: 'service' | 'env_group'
  target_id: string
  target_name: string
  environment_mapping: Array<{
    envmanager_env: string
  }>
}

// =====================================================
// Create Composable via Factory
// =====================================================

const basePlatformIntegration = createPlatformIntegration(
  RENDER_CONFIG,
  { syncFunctionName: 'render-sync' }
)

// =====================================================
// Extended Render Composable
// =====================================================

export function useRenderIntegration() {
  const base = basePlatformIntegration()
  const client = useSupabaseClient<Database>()
  const { $toast } = useNuxtApp()

  // Additional Render-specific state
  const validating = ref(false)
  const validationResult = ref<RenderValidationResult | null>(null)
  const services = ref<RenderService[]>([])
  const envGroups = ref<RenderEnvGroup[]>([])
  const loadingResources = ref(false)

  /**
   * Validate a Render API token
   * @param token - Render API key
   */
  const validateToken = async (token: string): Promise<RenderValidationResult> => {
    validating.value = true
    validationResult.value = null

    try {
      const { data, error } = await client.functions.invoke('render-validate', {
        body: { token }
      })

      if (error) throw error

      validationResult.value = data as RenderValidationResult
      return validationResult.value

    } catch (err) {
      console.error('[useRenderIntegration] Validation failed:', err)
      const result: RenderValidationResult = {
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
   * Connect Render account (save token and create connection)
   * Uses create_platform_integration RPC
   * @param organizationId - Organization to connect to
   * @param token - Render API key
   * @param name - User-defined connection name
   * @param ownerId - Owner ID to store in metadata
   * @param ownerName - Owner name to store in metadata
   */
  const connect = async (
    organizationId: string,
    token: string,
    name: string,
    ownerId?: string,
    ownerName?: string
  ): Promise<boolean> => {
    base.loading.value = true

    try {
      // Store token in Vault and create connection using RPC
      const { data: integrationId, error } = await client.rpc('create_platform_integration', {
        p_organization_id: organizationId,
        p_platform: 'render',
        p_name: name,
        p_api_token: token
      })

      if (error) throw error

      // If owner ID provided, update metadata
      if (ownerId && integrationId) {
        const { error: updateError } = await client
          .from('platform_integrations')
          .update({ metadata: { ownerId, ownerName } })
          .eq('id', integrationId)

        if (updateError) {
          console.error('[useRenderIntegration] Failed to store owner ID:', updateError)
          // Non-fatal - connection still works, just won't have default owner
        }
      }

      // Refresh connection
      await base.fetchOrgConnection(organizationId)
      $toast.success('Render connected successfully')
      return true

    } catch (err) {
      console.error('[useRenderIntegration] Connect failed:', err)
      $toast.error('Failed to connect Render')
      return false
    } finally {
      base.loading.value = false
    }
  }

  /**
   * List Render services and env groups for an owner
   */
  const listResources = async (
    connectionId: string,
    ownerId?: string
  ): Promise<{ services: RenderService[]; envGroups: RenderEnvGroup[] }> => {
    loadingResources.value = true
    services.value = []
    envGroups.value = []

    try {
      const { data, error } = await client.functions.invoke('render-list-resources', {
        body: { connection_id: connectionId, owner_id: ownerId }
      })

      if (error) throw error

      services.value = data.services || []
      envGroups.value = data.envGroups || []
      return { services: services.value, envGroups: envGroups.value }

    } catch (err) {
      console.error('[useRenderIntegration] List resources failed:', err)
      $toast.error('Failed to load Render resources')
      return { services: [], envGroups: [] }
    } finally {
      loadingResources.value = false
    }
  }

  /**
   * Create a new env group in Render
   * Uses render-list-resources Edge Function with name parameter
   */
  const createEnvGroup = async (
    connectionId: string,
    ownerId: string,
    name: string
  ): Promise<RenderEnvGroup | null> => {
    try {
      const { data, error } = await client.functions.invoke('render-list-resources', {
        body: {
          connection_id: connectionId,
          owner_id: ownerId,
          name  // Edge function detects create mode when name is provided
        }
      })

      if (error) throw error

      // Response has envGroup object with id and name
      if (data.envGroup) {
        const newEnvGroup: RenderEnvGroup = data.envGroup
        envGroups.value.push(newEnvGroup)
        $toast.success(`Env group "${newEnvGroup.name}" created`)
        return newEnvGroup
      }

      return null

    } catch (err) {
      console.error('[useRenderIntegration] Create env group failed:', err)
      $toast.error('Failed to create env group')
      return null
    }
  }

  /**
   * Create or update sync config with Render target (one per project)
   * Returns the sync config ID on success
   */
  const configureSyncTarget = async (
    connectionId: string,
    projectId: string,
    target: RenderSyncTarget,
    options: { autoSync?: boolean; syncSecrets?: boolean; syncVariables?: boolean } = {}
  ): Promise<string | null> => {
    try {
      const { data, error } = await client
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
        .select('id')
        .single()

      if (error) throw error

      $toast.success('Sync configuration saved')
      return data.id

    } catch (err) {
      console.error('[useRenderIntegration] Configure failed:', err)
      $toast.error('Failed to save configuration')
      return null
    }
  }

  return {
    // From base
    ...base,

    // Render-specific state
    validating,
    validationResult,
    services,
    envGroups,
    loadingResources,

    // Render-specific methods
    validateToken,
    connect,
    listResources,
    createEnvGroup,
    configureSyncTarget
  }
}
