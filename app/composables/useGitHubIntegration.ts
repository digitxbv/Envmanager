// =====================================================
// GitHub Integration Composable
// =====================================================
// Business logic for GitHub App integration
// Manages installation state, sync configs, and sync operations
// v1.1: Added project sync configs and per-environment configs

import type { Database, Json } from '~/types/database.types'
import type { PlatformConfig } from '~/types/integration.types'

// =====================================================
// Types
// =====================================================

interface GitHubInstallation {
  account_id: number
  account_login: string
  account_type: string
  created_at: string | null
  id: string
  installation_id: number
  installed_at: string | null
  installed_by: string | null
  organization_id: string
  permissions: Json | null
  repository_selection: string | null
  suspended_at: string | null
  uninstalled_at: string | null
  updated_at: string | null
}
type GitHubSyncHistory = Database['public']['Tables']['github_sync_history']['Row']
type GitHubProjectSyncConfig = Database['public']['Tables']['github_project_sync_configs']['Row']
type GitHubEnvironmentConfig = {
  id: string
  project_sync_config_id: string
  environment_id: string
  target_config: unknown
  prefix: string | null
  enabled: boolean
  last_synced_at: string | null
  last_status: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

// =====================================================
// Platform Config (static, for UI consistency)
// =====================================================

export const GITHUB_CONFIG: PlatformConfig = {
  id: 'github',
  name: 'GitHub',
  icon: 'simple-icons:github',
  color: '#24292f',
  description: 'Sync to GitHub Actions secrets and variables',
  supportsInstanceUrl: false,
  supportsSkipSsl: false
}

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
  }
  private: boolean
}

export interface SyncResult {
  success: boolean
  status: 'success' | 'partial' | 'failed'
  variables_synced: number
  secrets_synced: number
  errors?: Array<{ key: string; error: string }>
}

export interface UseGitHubIntegrationReturn {
  // State
  installation: Ref<GitHubInstallation | null>
  installations: Ref<GitHubInstallation[]>
  projectSyncConfig: Ref<GitHubProjectSyncConfig | null>
  envConfigs: Ref<GitHubEnvironmentConfig[]>
  loading: Ref<boolean>
  error: Ref<string | null>

  // Computed
  isConnected: ComputedRef<boolean>
  isAnyConnected: ComputedRef<boolean>

  // Org-level methods
  fetchInstallations: (organizationId: string) => Promise<GitHubInstallation[]>
  fetchInstallation: (organizationId: string) => Promise<void>
  connectGitHub: (organizationId: string) => void
  disconnectGitHub: (organizationId: string, installationId?: string) => Promise<void>
  fetchRepositories: (installationId?: string) => Promise<GitHubRepository[]>

  // v1.1 Methods
  fetchProjectSyncConfig: (projectId: string, installationId?: string | null) => Promise<GitHubProjectSyncConfig | null>
  enableForProject: (installationId: string, projectId: string) => Promise<GitHubProjectSyncConfig | null>
  disableForProject: (projectId: string, installationId: string) => Promise<void>
  triggerSyncAllEnvs: (projectSyncConfigId: string) => Promise<{ success: number; partial: number; failed: number; total: number }>
  fetchSyncHistoryV11: (projectSyncConfigId: string, limit?: number) => Promise<GitHubSyncHistory[]>
}

// =====================================================
// Composable
// =====================================================

export const useGitHubIntegration = () => {
  const client = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const { $toast } = useNuxtApp()
  const config = useRuntimeConfig()
  
  // =====================================================
  // State
  // =====================================================

  const installation = shallowRef<GitHubInstallation | null>(null)
  const installations = shallowRef<GitHubInstallation[]>([])
  const projectSyncConfig = ref<GitHubProjectSyncConfig | null>(null)
  const envConfigs = shallowRef<GitHubEnvironmentConfig[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  // =====================================================
  // Computed
  // =====================================================
  
  const isConnected = computed(() => {
    return installation.value !== null &&
           installation.value.id !== null &&
           !installation.value.uninstalled_at &&
           !installation.value.suspended_at
  })

  const isAnyConnected = computed(() => installations.value.some(item => (
    item.id !== null &&
    !item.uninstalled_at &&
    !item.suspended_at
  )))
  
  // =====================================================
  // Methods
  // =====================================================
  
  /**
   * Fetch all active GitHub installations for an organization.
   */
  const fetchInstallations = async (organizationId: string): Promise<GitHubInstallation[]> => {
    loading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await client
        .rpc('get_github_installations', { p_organization_id: organizationId })

      if (fetchError) throw fetchError

      const rows = (data || []) as GitHubInstallation[]
      installations.value = rows
      installation.value = rows[0] ?? null
      return rows
    } catch (err) {
      console.error('[useGitHubIntegration] Failed to fetch installations:', err)
      error.value = 'Failed to load GitHub connections'
      installations.value = []
      installation.value = null
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch the default GitHub installation for an organization.
   * Compatibility helper for older single-installation call sites.
   */
  const fetchInstallation = async (organizationId: string) => {
    await fetchInstallations(organizationId)
  }
  
  /**
   * Initiate GitHub App installation flow
   */
  const connectGitHub = (organizationId: string) => {
    if (!user.value) {
      $toast.error('Please sign in first')
      return
    }
    
    // Create state parameter: organizationId:userId
    const userId = user.value.id ?? user.value.sub
    const state = btoa(`${organizationId}:${userId}`)
    
    // Get GitHub App name from config
    const appName = config.public.githubAppName || 'EnvManager'
    
    // Redirect to GitHub App installation
    const installUrl = `https://github.com/apps/${appName}/installations/new?state=${state}`
    window.location.href = installUrl
  }
  
  /**
   * Disconnect GitHub (mark installation as uninstalled)
   * Note: User should also uninstall from GitHub directly
   */
  const disconnectGitHub = async (organizationId: string, installationId?: string) => {
    const disconnectedId = installationId || ((installation.value as { id: string } | null)?.id)
    if (!disconnectedId) return
    
    loading.value = true
     
    try {
      const { error: updateError } = await client
        .from('github_installations')
        .update({ uninstalled_at: new Date().toISOString() })
        .eq('id', disconnectedId)
      
      if (updateError) throw updateError
      
      installation.value = null
      const remainingInstallations: GitHubInstallation[] = []
      for (const item of installations.value as GitHubInstallation[]) {
        if (item.id !== disconnectedId) {
          remainingInstallations.push(item)
        }
      }
      installations.value = remainingInstallations
      installation.value = remainingInstallations[0] ?? null
      envConfigs.value = []

      $toast.success('GitHub disconnected. Remember to also uninstall the app from GitHub.')
    } catch (err) {
      console.error('[useGitHubIntegration] Failed to disconnect:', err)
      $toast.error('Failed to disconnect GitHub')
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Fetch accessible repositories from the installation
   * @param installationId - Optional installation ID. If not provided, uses the current installation state.
   */
  const fetchRepositories = async (installationId?: string): Promise<GitHubRepository[]> => {
    const id = installationId || installation.value?.id

    if (!id) {
      console.log('[useGitHubIntegration] No installation ID, returning empty array')
      return []
    }

    try {
      // Call edge function to list repos (it handles token generation)
      const { data, error: invokeError } = await client.functions.invoke('github-list-repos', {
        body: { installation_id: id }
      })

      if (invokeError) throw invokeError

      if (data?.error) {
        console.error('[useGitHubIntegration] Function returned error:', data.error)
      }

      return data?.repositories || []
    } catch (err) {
      console.error('[useGitHubIntegration] Failed to fetch repositories:', err)
      $toast.error('Failed to load repositories')
      return []
    }
  }
  
  // =====================================================
  // v1.1 Methods (Project-level sync config)
  // =====================================================

  /**
   * Fetch project sync config for a project
   */
  const fetchProjectSyncConfig = async (projectId: string, installationId?: string | null): Promise<GitHubProjectSyncConfig | null> => {
    const requestedInstallationId = installationId === undefined ? installation.value?.id : installationId

    if (requestedInstallationId !== null && !requestedInstallationId && installations.value.length === 0) {
      projectSyncConfig.value = null
      envConfigs.value = []
      return null
    }

    try {
      let query = client
        .from('github_project_sync_configs')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(1)

      if (requestedInstallationId) {
        query = query.eq('installation_id', requestedInstallationId)
      }

      const { data, error: fetchError } = await query.maybeSingle()

      if (fetchError) throw fetchError

      projectSyncConfig.value = data

      if (data) {
        const { data: envData, error: envError } = await client
          .from('github_environment_configs')
          .select('*')
          .eq('project_sync_config_id', data.id)

        if (envError) {
          console.error('[useGitHubIntegration] Failed to fetch env configs:', envError)
        }
        envConfigs.value = envData || []
      } else {
        envConfigs.value = []
      }

      return data
    } catch (err) {
      console.error('[useGitHubIntegration] Failed to fetch project sync config:', err)
      return null
    }
  }

  /**
   * Enable GitHub for a project (create project sync config)
   */
  const enableForProject = async (
    installationId: string,
    projectId: string
  ): Promise<GitHubProjectSyncConfig | null> => {
    loading.value = true

    try {
      const { data, error: rpcError } = await client
        .rpc('enable_github_for_project', {
          p_installation_id: installationId,
          p_project_id: projectId
        })

      if (rpcError) throw rpcError

      const createdConfig = data as GitHubProjectSyncConfig

      if (createdConfig?.sync_mode !== 'all') {
        const { data: updatedConfig, error: updateError } = await client
          .from('github_project_sync_configs')
          .update({ sync_mode: 'all', updated_at: new Date().toISOString() })
          .eq('id', createdConfig.id)
          .select()
          .single()

        if (updateError) {
          console.error('[useGitHubIntegration] Failed to set default sync mode:', updateError)
          projectSyncConfig.value = createdConfig
        } else {
          projectSyncConfig.value = updatedConfig as GitHubProjectSyncConfig
        }
      } else {
        projectSyncConfig.value = createdConfig
      }
      $toast.success('GitHub enabled for this project')
      return data as GitHubProjectSyncConfig
    } catch (err) {
      console.error('[useGitHubIntegration] Failed to enable for project:', err)
      $toast.error('Failed to enable GitHub')
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Disable GitHub for a project (delete project sync config)
   */
  const disableForProject = async (projectId: string, installationId: string) => {
    loading.value = true

    try {
      const { error: rpcError } = await client
        .rpc('disable_github_for_project', {
          p_project_id: projectId,
          p_installation_id: installationId
        })

      if (rpcError) throw rpcError

      projectSyncConfig.value = null
      envConfigs.value = []
      $toast.success('GitHub disabled for this project')
    } catch (err) {
      console.error('[useGitHubIntegration] Failed to disable for project:', err)
      $toast.error('Failed to disable GitHub')
    } finally {
      loading.value = false
    }
  }

  /**
   * Trigger sync for ALL enabled environment configs
   */
  const triggerSyncAllEnvs = async (
    projectSyncConfigId: string
  ): Promise<{ success: number; partial: number; failed: number; total: number }> => {
    loading.value = true

    try {
      // Get all enabled environment configs
      const { data: configs, error: fetchError } = await client
        .from('github_environment_configs')
        .select('id, environment_id')
        .eq('project_sync_config_id', projectSyncConfigId)
        .eq('enabled', true)

      if (fetchError) throw fetchError

      if (!configs || configs.length === 0) {
        $toast.warning('No environments configured for GitHub sync')
        return { success: 0, partial: 0, failed: 0, total: 0 }
      }

      let success = 0
      let partial = 0
      let failed = 0

      // Sync each environment config
      for (const config of configs) {
        try {
          const { data, error: invokeError } = await client.functions.invoke('github-sync', {
            body: {
              env_config_id: config.id,
              trigger_type: 'manual'
            }
          })

          if (invokeError) {
            failed++
            console.error(`[useGitHubIntegration] Sync failed for env config ${config.id}:`, invokeError)
          } else if (data?.status === 'partial') {
            partial++
          } else if (data?.success === false || data?.status === 'failed') {
            failed++
          } else {
            success++
          }
        } catch (err) {
          failed++
          console.error(`[useGitHubIntegration] Sync exception for env config ${config.id}:`, err)
        }
      }

      // Summary toast
      const total = configs.length
      if (failed === 0 && partial === 0) {
        $toast.success(`Synced ${success} environment${success !== 1 ? 's' : ''} to GitHub`)
      } else if (success === 0 && partial === 0) {
        $toast.error(`All ${failed} environment syncs failed`)
      } else {
        $toast.warning(`Sync result: ${success} success, ${partial} partial, ${failed} failed (${total} total)`)
      }

      return { success, partial, failed, total }
    } catch (err) {
      console.error('[useGitHubIntegration] Sync all failed:', err)
      $toast.error('Failed to sync to GitHub')
      return { success: 0, partial: 0, failed: 0, total: 0 }
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch sync history for v1.1 (by project sync config, via env_config_id)
   */
  const fetchSyncHistoryV11 = async (projectSyncConfigId: string, limit = 10): Promise<GitHubSyncHistory[]> => {
    try {
      // Get all environment config IDs for this project sync config
      const { data: configs, error: configError } = await client
        .from('github_environment_configs')
        .select('id')
        .eq('project_sync_config_id', projectSyncConfigId)

      if (configError) throw configError

      if (!configs || configs.length === 0) {
        return []
      }

      const envConfigIds = configs.map(c => c.id)

      // Fetch history for all env configs
      const { data, error: fetchError } = await client
        .from('github_sync_history')
        .select('*')
        .in('env_config_id', envConfigIds)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (fetchError) throw fetchError

      return (data as GitHubSyncHistory[]) || []
    } catch (err) {
      console.error('[useGitHubIntegration] Failed to fetch sync history v1.1:', err)
      return []
    }
  }

  // =====================================================
  // Return Public API
  // =====================================================
  
  return {
    // State
    installation,
    installations,
    projectSyncConfig,
    envConfigs,
    loading,
    error,

    // Computed
    isConnected,
    isAnyConnected,

    // Org-level methods
    fetchInstallations,
    fetchInstallation,
    connectGitHub,
    disconnectGitHub,
    fetchRepositories,

    // v1.1 Methods
    fetchProjectSyncConfig,
    enableForProject,
    disableForProject,
    triggerSyncAllEnvs,
    fetchSyncHistoryV11
  }
}
