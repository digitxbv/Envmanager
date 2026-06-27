// =====================================================
// Vercel Integration Composable
// =====================================================
// Vercel-specific integration using the platform factory
// Handles connection, validation, project listing, and sync

import { createPlatformIntegration } from './usePlatformIntegration'
import type { PlatformConfig } from '~/types/integration.types'
import type { Database, Json } from '~/types/database.types'

// =====================================================
// Vercel Platform Config
// =====================================================

export const VERCEL_CONFIG: PlatformConfig = {
  id: 'vercel',
  name: 'Vercel',
  icon: 'simple-icons:vercel',
  color: '#000000',
  description: 'Sync environment variables to Vercel projects',
  supportsInstanceUrl: false,
  supportsSkipSsl: false
}

// =====================================================
// Vercel-Specific Types
// =====================================================

export interface VercelUser {
  id: string
  username: string
  email: string
  name: string | null
}

export interface VercelTeam {
  id: string
  name: string
  slug: string
}

export interface VercelProject {
  id: string
  name: string
  framework: string | null
  updatedAt: number
}

export interface VercelValidationResult {
  valid: boolean
  user?: VercelUser
  teams?: VercelTeam[]
  error?: string
}

export interface VercelSyncTarget {
  project_id: string
  project_name: string
  team_id: string | null
  environment_mapping: Array<{
    envmanager_env: string  // EnvManager environment ID
    vercel_targets: ('production' | 'preview' | 'development')[]
    git_branch?: string  // For preview branch filtering (VERC-05)
  }>
}

// =====================================================
// Create Composable via Factory
// =====================================================

const basePlatformIntegration = createPlatformIntegration(
  VERCEL_CONFIG,
  { syncFunctionName: 'vercel-sync' }
)

// =====================================================
// Extended Vercel Composable
// =====================================================

export function useVercelIntegration() {
  const base = basePlatformIntegration()
  const client = useSupabaseClient<Database>()
  const { $toast } = useNuxtApp()

  // Additional Vercel-specific state
  const validating = ref(false)
  const validationResult = ref<VercelValidationResult | null>(null)
  const projects = ref<VercelProject[]>([])
  const loadingProjects = ref(false)

  /**
   * Validate a Vercel access token
   */
  const validateToken = async (token: string): Promise<VercelValidationResult> => {
    validating.value = true
    validationResult.value = null

    try {
      const { data, error } = await client.functions.invoke('vercel-validate', {
        body: { token }
      })

      if (error) throw error

      validationResult.value = data as VercelValidationResult
      return validationResult.value

    } catch (err) {
      console.error('[useVercelIntegration] Validation failed:', err)
      const result: VercelValidationResult = {
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
   * Connect Vercel account (save token and create connection)
   * Uses create_platform_integration RPC from Plan 01
   */
  const connect = async (
    organizationId: string,
    token: string,
    name: string
  ): Promise<boolean> => {
    base.loading.value = true

    try {
      // First validate the token
      const validation = await validateToken(token)
      if (!validation.valid) {
        $toast.error(validation.error || 'Invalid token')
        return false
      }

      // Store token in Vault and create connection using RPC from Plan 01
      const { data, error } = await client.rpc('create_platform_integration', {
        p_organization_id: organizationId,
        p_platform: 'vercel',
        p_name: name,
        p_api_token: token
      })

      if (error) throw error

      // Refresh connection
      await base.fetchOrgConnection(organizationId)
      $toast.success('Vercel connected successfully')
      return true

    } catch (err) {
      console.error('[useVercelIntegration] Connect failed:', err)
      $toast.error('Failed to connect Vercel')
      return false
    } finally {
      base.loading.value = false
    }
  }

  /**
   * List Vercel projects
   */
  const listProjects = async (connectionId: string, teamId?: string): Promise<VercelProject[]> => {
    loadingProjects.value = true
    projects.value = []

    try {
      const { data, error } = await client.functions.invoke('vercel-list-projects', {
        body: { connection_id: connectionId, team_id: teamId }
      })

      if (error) throw error

      projects.value = data.projects || []
      return projects.value

    } catch (err) {
      console.error('[useVercelIntegration] List projects failed:', err)
      $toast.error('Failed to load Vercel projects')
      return []
    } finally {
      loadingProjects.value = false
    }
  }

  /**
   * Create or update sync config with Vercel target (one per project)
   */
  const configureSyncTarget = async (
    connectionId: string,
    projectId: string,
    target: VercelSyncTarget,
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
      console.error('[useVercelIntegration] Configure failed:', err)
      $toast.error('Failed to save configuration')
      return false
    }
  }

  return {
    // From base
    ...base,

    // Vercel-specific state
    validating,
    validationResult,
    projects,
    loadingProjects,

    // Vercel-specific methods
    validateToken,
    connect,
    listProjects,
    configureSyncTarget
  }
}
