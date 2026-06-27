// =====================================================
// GitHub Sync Edge Function
// =====================================================
// Syncs environment variables and secrets from EnvManager to GitHub Actions.
// Handles encryption of secrets using GitHub's public key (LibSodium sealed box).
//
// Endpoints:
// POST /github-sync - Sync variables to GitHub (manual sync)
//   Body: { env_config_id: string, trigger_type: 'auto' | 'manual' }
//   - env_config_id: v1.1 sync (from github_environment_configs)
//
// POST /github-sync/process-queue - Process auto-sync queue (internal)
//   Called by scheduler to process pending syncs from github_pending_syncs table.
//   No body required - uses service role auth.
//
// Deploy with: supabase functions deploy github-sync

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import sodium from 'https://esm.sh/libsodium-wrappers-sumo@0.7.15'
import { applyPrefix } from '../_shared/prefix.js'
import { createGitHubAppJWT } from '../_shared/github-jwt.js'
import { getCorsHeaders } from '../_shared/cors.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logError } from '../_shared/logger.js'
import { requireEnv } from '../_shared/require-env.ts'

// =====================================================
// Types
// =====================================================

interface SyncRequest {
  env_config_id: string
  trigger_type: 'auto' | 'manual'
}

interface SyncConfig {
  id: string
  environment_id: string
  installation_id: string
  sync_level: 'repository' | 'environment' | 'organization'
  repo_owner: string | null
  repo_name: string | null
  github_environment: string | null
  github_org_visibility?: 'all' | 'private'
  sync_secrets: boolean
  sync_variables: boolean
  sync_mode: 'all' | 'selected'
  variable_storage_mode: 'preserve_types' | 'all_as_secrets'
  prefix?: string | null
}

interface GitHubInstallation {
  id: string
  installation_id: number
  organization_id: string
}

interface Variable {
  id: string
  key: string
  value: string
  is_secret: boolean
}

interface SyncEntry extends Variable {
  syncKey: string
  syncAsSecret: boolean
}

interface GitHubPublicKey {
  key_id: string
  key: string
}

interface SyncResult {
  variables_synced: number
  secrets_synced: number
  errors: Array<{ key: string; error: string }>
}


// =====================================================
// GitHub API Helpers
// =====================================================

async function getInstallationAccessToken(
  installationId: number,
  appJwt: string
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${appJwt}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get access token: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.token
}

async function getPublicKey(
  token: string,
  syncLevel: string,
  repoOwner: string | null,
  repoName: string | null,
  githubEnv: string | null
): Promise<GitHubPublicKey> {
  let url: string

  if (syncLevel === 'organization') {
    url = `https://api.github.com/orgs/${repoOwner}/actions/secrets/public-key`
  } else if (syncLevel === 'environment' && githubEnv) {
    url = `https://api.github.com/repos/${repoOwner}/${repoName}/environments/${githubEnv}/secrets/public-key`
  } else {
    url = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/secrets/public-key`
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get public key: ${response.status} - ${error}`)
  }

  return await response.json()
}

// =====================================================
// Secret Encryption (LibSodium Sealed Box)
// =====================================================

let sodiumInit: Promise<void> | null = null

async function ensureSodiumReady(): Promise<void> {
  if (!sodiumInit) {
    sodiumInit = sodium.ready
  }
  await sodiumInit
}

async function encryptSecret(secret: string, publicKey: string): Promise<string> {
  await ensureSodiumReady()

  // GitHub returns the public key as base64 (ORIGINAL variant)
  const publicKeyBytes = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL)
  const secretBytes = sodium.from_string(secret)

  // GitHub requires libsodium sealed box encryption
  const encryptedBytes = sodium.crypto_box_seal(secretBytes, publicKeyBytes)

  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL)
}

// =====================================================
// Sync Operations
// =====================================================

async function syncSecret(
  token: string,
  config: SyncConfig,
  key: string,
  value: string,
  publicKey: GitHubPublicKey
): Promise<void> {
  const encryptedValue = await encryptSecret(value, publicKey.key)

  let url: string
  if (config.sync_level === 'organization') {
    url = `https://api.github.com/orgs/${config.repo_owner}/actions/secrets/${key}`
  } else if (config.sync_level === 'environment' && config.github_environment) {
    url = `https://api.github.com/repos/${config.repo_owner}/${config.repo_name}/environments/${config.github_environment}/secrets/${key}`
  } else {
    url = `https://api.github.com/repos/${config.repo_owner}/${config.repo_name}/actions/secrets/${key}`
  }

  const body: Record<string, unknown> = {
    encrypted_value: encryptedValue,
    key_id: publicKey.key_id
  }

  if (config.sync_level === 'organization') {
    body.visibility = config.github_org_visibility || 'all'
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to sync secret: ${response.status} - ${error}`)
  }
}

async function syncVariable(
  token: string,
  config: SyncConfig,
  key: string,
  value: string
): Promise<void> {
  let url: string

  if (config.sync_level === 'organization') {
    url = `https://api.github.com/orgs/${config.repo_owner}/actions/variables/${key}`
  } else if (config.sync_level === 'environment' && config.github_environment) {
    url = `https://api.github.com/repos/${config.repo_owner}/${config.repo_name}/environments/${config.github_environment}/variables/${key}`
  } else {
    url = `https://api.github.com/repos/${config.repo_owner}/${config.repo_name}/actions/variables/${key}`
  }

  // Try to update first (PATCH)
  const patchBody: Record<string, unknown> = { value }

  if (config.sync_level === 'organization') {
    patchBody.visibility = config.github_org_visibility || 'all'
  }

  const patchResponse = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(patchBody)
  })

  if (patchResponse.ok) {
    return // Updated successfully
  }

  if (patchResponse.status === 404) {
    // Variable doesn't exist, create it
    const createUrl = url.replace(`/${key}`, '')
    const body: Record<string, unknown> = {
      name: key,
      value
    }

    if (config.sync_level === 'organization') {
      body.visibility = config.github_org_visibility || 'all'
    }

    const postResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!postResponse.ok) {
      const error = await postResponse.text()
      throw new Error(`Failed to create variable: ${postResponse.status} - ${error}`)
    }
  } else {
    const error = await patchResponse.text()
    throw new Error(`Failed to update variable: ${patchResponse.status} - ${error}`)
  }
}

function buildSecretUrl(config: SyncConfig, key: string): string {
  if (config.sync_level === 'organization') {
    return `https://api.github.com/orgs/${config.repo_owner}/actions/secrets/${key}`
  }
  if (config.sync_level === 'environment') {
    return `https://api.github.com/repos/${config.repo_owner}/${config.repo_name}/environments/${config.github_environment}/secrets/${key}`
  }
  return `https://api.github.com/repos/${config.repo_owner}/${config.repo_name}/actions/secrets/${key}`
}

function buildVariableUrl(config: SyncConfig, key: string): string {
  if (config.sync_level === 'organization') {
    return `https://api.github.com/orgs/${config.repo_owner}/actions/variables/${key}`
  }
  if (config.sync_level === 'environment') {
    return `https://api.github.com/repos/${config.repo_owner}/${config.repo_name}/environments/${config.github_environment}/variables/${key}`
  }
  return `https://api.github.com/repos/${config.repo_owner}/${config.repo_name}/actions/variables/${key}`
}

async function deleteSecret(token: string, config: SyncConfig, key: string): Promise<boolean> {
  const url = buildSecretUrl(config, key)
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })

  if (response.status === 204) return true
  if (response.status === 404) return false

  const error = await response.text()
  throw new Error(`Failed to delete secret: ${response.status} - ${error}`)
}

async function deleteVariable(token: string, config: SyncConfig, key: string): Promise<boolean> {
  const url = buildVariableUrl(config, key)
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })

  if (response.status === 204) return true
  if (response.status === 404) return false

  const error = await response.text()
  throw new Error(`Failed to delete variable: ${response.status} - ${error}`)
}

function buildSyncEntries(variables: Variable[], config: SyncConfig): SyncEntry[] {
  return variables
    .filter(variable => (variable.is_secret && config.sync_secrets) || (!variable.is_secret && config.sync_variables))
    .map(variable => ({
      ...variable,
      syncKey: applyPrefix(variable.key, config.prefix ?? null),
      syncAsSecret: config.variable_storage_mode === 'all_as_secrets' || variable.is_secret
    }))
}

// =====================================================
// v1.1 Sync Handler (env_config_id based)
// =====================================================

async function handleV11Sync(
  serviceClient: any,
  userClient: any,
  userId: string,
  envConfigId: string,
  triggerType: 'auto' | 'manual'
) {
  console.log(`[github-sync v1.1] Starting sync for env config ${envConfigId}`)

  // Get environment config with joined project sync config
  const { data: envConfig, error: envConfigError } = await userClient
    .from('github_environment_configs')
    .select(`
      *,
      project_sync_config:github_project_sync_configs(
        *,
        installation:github_installations(*)
      )
    `)
    .eq('id', envConfigId)
    .single()

  if (envConfigError || !envConfig) {
    console.error('[github-sync v1.1] Config not found:', envConfigError)
    return {
      success: false,
      status: 'failed',
      variables_synced: 0,
      secrets_synced: 0,
      errors: [{ key: 'config', error: 'Environment config not found' }]
    }
  }

  const projectSyncConfig = envConfig.project_sync_config
  const installation = projectSyncConfig?.installation

  if (!installation || installation.uninstalled_at || installation.suspended_at) {
    return {
      success: false,
      status: 'failed',
      variables_synced: 0,
      secrets_synced: 0,
      errors: [{ key: 'installation', error: 'GitHub App is not active' }]
    }
  }

  // Parse target_config
  const targetConfig = envConfig.target_config as any
  const config: SyncConfig = {
    id: envConfig.id,
    environment_id: envConfig.environment_id,
    installation_id: projectSyncConfig.installation_id,
    sync_level: targetConfig.sync_level || 'repository',
    repo_owner: targetConfig.repo_owner,
    repo_name: targetConfig.repo_name,
    github_environment: targetConfig.github_environment,
    github_org_visibility: targetConfig.github_org_visibility || 'all',
    sync_secrets: targetConfig.sync_secrets ?? projectSyncConfig.sync_secrets,
    sync_variables: targetConfig.sync_variables ?? projectSyncConfig.sync_variables,
    sync_mode: projectSyncConfig.sync_mode,
    variable_storage_mode: projectSyncConfig.variable_storage_mode ?? 'preserve_types',
    prefix: envConfig.prefix
  }

  // Validate config
  if (config.sync_level === 'organization' && !config.repo_owner) {
    return {
      success: false,
      status: 'failed',
      variables_synced: 0,
      secrets_synced: 0,
      errors: [{ key: 'config', error: 'Organization not configured' }]
    }
  }

  if (config.sync_level === 'environment' && (!config.repo_owner || !config.repo_name || !config.github_environment)) {
    return {
      success: false,
      status: 'failed',
      variables_synced: 0,
      secrets_synced: 0,
      errors: [{ key: 'config', error: 'Environment not configured' }]
    }
  }

  if (config.sync_level === 'repository' && (!config.repo_owner || !config.repo_name)) {
    return {
      success: false,
      status: 'failed',
      variables_synced: 0,
      secrets_synced: 0,
      errors: [{ key: 'config', error: 'Repository not configured' }]
    }
  }

  // Get variables to sync
  const { data: variables, error: varsError } = await userClient
    .rpc('get_variables_to_sync', {
      p_environment_id: config.environment_id,
      p_sync_mode: config.sync_mode
    })

  if (varsError) {
    console.error('[github-sync v1.1] Failed to get variables:', varsError)
    return {
      success: false,
      status: 'failed',
      variables_synced: 0,
      secrets_synced: 0,
      errors: [{ key: 'variables', error: 'Failed to get variables' }]
    }
  }

  const variablesList = (variables || []) as Variable[]
  const syncEntries = buildSyncEntries(variablesList, config)
  const syncedKeys = syncEntries.map(entry => entry.syncKey)

  const { data: keysToDelete, error: trackError } = await serviceClient
    .rpc('update_github_synced_keys', {
      p_env_config_id: envConfigId,
      p_synced_keys: syncedKeys
    })

  if (trackError) {
    console.warn('[github-sync v1.1] Failed to update synced keys tracking:', trackError)
  }

  const keysToDeleteList = (keysToDelete || []) as string[]

  const result: SyncResult = {
    variables_synced: 0,
    secrets_synced: 0,
    errors: []
  }

  let deletedCount = 0
  const deletionErrors: Array<{ key: string; error: string }> = []

  const shouldCallGitHub = syncEntries.length > 0 || keysToDeleteList.length > 0

  if (shouldCallGitHub) {
    const appId = Deno.env.get('GITHUB_APP_ID')!
    const privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY')!

    const appJwt = await createGitHubAppJWT(appId, privateKey)
    const accessToken = await getInstallationAccessToken(installation.installation_id, appJwt)

    let publicKey: GitHubPublicKey | null = null
    const hasSecrets = syncEntries.some(entry => entry.syncAsSecret)

    if (hasSecrets) {
      publicKey = await getPublicKey(
        accessToken,
        config.sync_level,
        config.repo_owner,
        config.repo_name,
        config.github_environment
      )
    }

    // Delete removed keys
    for (const key of keysToDeleteList) {
      let deleted = false

      try {
        const secretDeleted = await deleteSecret(accessToken, config, key)
        deleted = deleted || secretDeleted
      } catch (error) {
        deletionErrors.push({
          key,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      try {
        const variableDeleted = await deleteVariable(accessToken, config, key)
        deleted = deleted || variableDeleted
      } catch (error) {
        deletionErrors.push({
          key,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      if (deleted) {
        deletedCount++
      }
    }

    // Sync each variable
    for (const entry of syncEntries) {
      try {
        if (entry.syncAsSecret) {
          // Ensure key does not remain as a GitHub variable when mode maps it to secret.
          try {
            await deleteVariable(accessToken, config, entry.syncKey)
          } catch (cleanupError) {
            result.errors.push({
              key: entry.key,
              error: cleanupError instanceof Error ? `Cleanup variable failed: ${cleanupError.message}` : 'Cleanup variable failed'
            })
          }

          if (publicKey) {
            await syncSecret(accessToken, config, entry.syncKey, entry.value, publicKey)
            result.secrets_synced++
            console.log(`[github-sync v1.1] Synced secret: ${entry.syncKey}`)
          } else {
            throw new Error('Missing GitHub public key for secret sync')
          }
        } else {
          // Ensure key does not remain as a GitHub secret when mode maps it to variable.
          try {
            await deleteSecret(accessToken, config, entry.syncKey)
          } catch (cleanupError) {
            result.errors.push({
              key: entry.key,
              error: cleanupError instanceof Error ? `Cleanup secret failed: ${cleanupError.message}` : 'Cleanup secret failed'
            })
          }

          await syncVariable(accessToken, config, entry.syncKey, entry.value)
          result.variables_synced++
          console.log(`[github-sync v1.1] Synced variable: ${entry.syncKey}`)
        }
      } catch (error) {
        console.error(`[github-sync v1.1] Failed to sync ${entry.key}:`, error)
        result.errors.push({
          key: entry.key,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }

  if (deletionErrors.length > 0) {
    result.errors.push(...deletionErrors)
  }

  const status = result.errors.length === 0
    ? 'success'
    : (result.variables_synced + result.secrets_synced > 0 ? 'partial' : 'failed')

  const { error: historyError } = await serviceClient.rpc('record_github_sync_v11', {
    p_env_config_id: envConfigId,
    p_triggered_by: userId,
    p_trigger_type: triggerType,
    p_variables_synced: result.variables_synced,
    p_secrets_synced: result.secrets_synced,
    p_status: status,
    p_error_message: result.errors.length > 0 ? result.errors[0].error : null,
    p_details: {
      synced_keys: syncedKeys,
      deleted_keys: keysToDeleteList,
      deleted_count: deletedCount,
      deletion_errors: deletionErrors,
      errors: result.errors
    }
  })
  if (historyError) {
    console.error('[github-sync v1.1] Failed to record sync history:', historyError)
  }

  console.log(`[github-sync v1.1] Completed: ${result.variables_synced} vars, ${result.secrets_synced} secrets, ${result.errors.length} errors`)

  return {
    success: status !== 'failed',
    status,
    variables_synced: result.variables_synced,
    secrets_synced: result.secrets_synced,
    errors: result.errors
  }
}

// =====================================================
// Auto-Sync Queue Processor
// =====================================================

async function processAutoSyncQueue(serviceClient: any, corsHeaders: HeadersInit) {
  console.log('[github-sync] Processing auto-sync queue')

  // Get pending queue items (v1.1 only - those with env_config_id)
  const { data: queue, error } = await serviceClient.rpc('get_pending_github_syncs', { p_limit: 10 })

  if (error) {
    logError(error, { functionName: 'github-sync', context: 'get_pending_syncs' })
    return jsonResponse({ processed: 0, error: 'Failed to get pending syncs' }, corsHeaders)
  }

  if (!queue || queue.length === 0) {
    console.log('[github-sync] No pending syncs in queue')
    return jsonResponse({ processed: 0 }, corsHeaders)
  }

  console.log(`[github-sync] Found ${queue.length} pending syncs`)

  let processed = 0
  const results: Array<{ env_config_id: string; status: string; error?: string }> = []

  for (const item of queue) {
    try {
      console.log(`[github-sync] Processing queue item ${item.pending_sync_id} for env config ${item.env_config_id}`)

      // Mark as processing
      await serviceClient.rpc('mark_sync_processing', { p_pending_sync_id: item.pending_sync_id })

      // Get environment config with joined project sync config
      const { data: envConfig, error: configError } = await serviceClient
        .from('github_environment_configs')
        .select(`
          *,
          project_sync_config:github_project_sync_configs(
            *,
            installation:github_installations(*)
          )
        `)
        .eq('id', item.env_config_id)
        .single()

      if (configError || !envConfig) {
        console.warn(`[github-sync] Config not found for ${item.env_config_id}`)
        await serviceClient.rpc('mark_sync_failed', {
          p_pending_sync_id: item.pending_sync_id,
          p_error: 'Environment config not found'
        })
        results.push({ env_config_id: item.env_config_id, status: 'failed', error: 'Config not found' })
        continue
      }

      const projectSyncConfig = envConfig.project_sync_config
      const installation = projectSyncConfig?.installation

      if (!installation || installation.uninstalled_at || installation.suspended_at) {
        console.warn(`[github-sync] Installation not active for ${item.env_config_id}`)
        await serviceClient.rpc('mark_sync_failed', {
          p_pending_sync_id: item.pending_sync_id,
          p_error: 'GitHub App is not active'
        })
        results.push({ env_config_id: item.env_config_id, status: 'failed', error: 'Installation not active' })
        continue
      }

      // Parse target_config
      const targetConfig = envConfig.target_config as any
      const config: SyncConfig = {
        id: envConfig.id,
        environment_id: envConfig.environment_id,
        installation_id: projectSyncConfig.installation_id,
        sync_level: targetConfig.sync_level || 'repository',
        repo_owner: targetConfig.repo_owner,
        repo_name: targetConfig.repo_name,
        github_environment: targetConfig.github_environment,
        github_org_visibility: targetConfig.github_org_visibility || 'all',
        sync_secrets: targetConfig.sync_secrets ?? projectSyncConfig.sync_secrets,
        sync_variables: targetConfig.sync_variables ?? projectSyncConfig.sync_variables,
        sync_mode: projectSyncConfig.sync_mode,
        variable_storage_mode: projectSyncConfig.variable_storage_mode ?? 'preserve_types',
        prefix: envConfig.prefix
      }

      // Validate config
      if (config.sync_level === 'organization' && !config.repo_owner) {
        await serviceClient.rpc('mark_sync_failed', {
          p_pending_sync_id: item.pending_sync_id,
          p_error: 'Organization not configured'
        })
        results.push({ env_config_id: item.env_config_id, status: 'failed', error: 'Organization not configured' })
        continue
      }

      if (config.sync_level === 'environment' && (!config.repo_owner || !config.repo_name || !config.github_environment)) {
        await serviceClient.rpc('mark_sync_failed', {
          p_pending_sync_id: item.pending_sync_id,
          p_error: 'Environment not configured'
        })
        results.push({ env_config_id: item.env_config_id, status: 'failed', error: 'Environment not configured' })
        continue
      }

      if (config.sync_level === 'repository' && (!config.repo_owner || !config.repo_name)) {
        await serviceClient.rpc('mark_sync_failed', {
          p_pending_sync_id: item.pending_sync_id,
          p_error: 'Repository not configured'
        })
        results.push({ env_config_id: item.env_config_id, status: 'failed', error: 'Repository not configured' })
        continue
      }

      // Get variables to sync
      const { data: variables, error: varsError } = await serviceClient
        .rpc('get_variables_for_sync', {
          p_environment_id: config.environment_id,
          p_sync_secrets: config.sync_secrets,
          p_sync_variables: config.sync_variables,
          p_include_fallbacks: false
        })

      if (varsError) {
        console.error('[github-sync] Failed to get variables:', varsError)
        await serviceClient.rpc('mark_sync_failed', {
          p_pending_sync_id: item.pending_sync_id,
          p_error: 'Failed to get variables'
        })
        results.push({ env_config_id: item.env_config_id, status: 'failed', error: 'Failed to get variables' })
        continue
      }

      let variablesList = (variables || []) as Variable[]

      if (config.sync_mode === 'selected') {
        const { data: selectedVariables, error: selectedError } = await serviceClient
          .from('variables')
          .select('id')
          .eq('environment_id', config.environment_id)
          .eq('sync_to_github', true)

        if (selectedError) {
          console.error('[github-sync] Failed to get selected variables:', selectedError)
          await serviceClient.rpc('mark_sync_failed', {
            p_pending_sync_id: item.pending_sync_id,
            p_error: 'Failed to get selected variables'
          })
          results.push({ env_config_id: item.env_config_id, status: 'failed', error: 'Failed to get selected variables' })
          continue
        }

        const selectedVariableIds = new Set((selectedVariables || []).map((variable: { id: string }) => variable.id))
        variablesList = variablesList.filter(variable => selectedVariableIds.has(variable.id))
      }

      const syncEntries = buildSyncEntries(variablesList, config)
      const syncedKeys = syncEntries.map(entry => entry.syncKey)

      const { data: keysToDelete, error: trackError } = await serviceClient
        .rpc('update_github_synced_keys', {
          p_env_config_id: item.env_config_id,
          p_synced_keys: syncedKeys
        })

      if (trackError) {
        console.warn('[github-sync queue] Failed to update synced keys tracking:', trackError)
      }

      const keysToDeleteList = (keysToDelete || []) as string[]

      const result: SyncResult = {
        variables_synced: 0,
        secrets_synced: 0,
        errors: []
      }

      let deletedCount = 0
      const deletionErrors: Array<{ key: string; error: string }> = []

      const shouldCallGitHub = syncEntries.length > 0 || keysToDeleteList.length > 0

      if (shouldCallGitHub) {
        const appId = Deno.env.get('GITHUB_APP_ID')!
        const privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY')!

        const appJwt = await createGitHubAppJWT(appId, privateKey)
        const accessToken = await getInstallationAccessToken(installation.installation_id, appJwt)

        let publicKey: GitHubPublicKey | null = null
        const hasSecrets = syncEntries.some(entry => entry.syncAsSecret)

        if (hasSecrets) {
          publicKey = await getPublicKey(
            accessToken,
            config.sync_level,
            config.repo_owner,
            config.repo_name,
            config.github_environment
          )
        }

        for (const key of keysToDeleteList) {
          let deleted = false

          try {
            const secretDeleted = await deleteSecret(accessToken, config, key)
            deleted = deleted || secretDeleted
          } catch (error) {
            deletionErrors.push({
              key,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }

          try {
            const variableDeleted = await deleteVariable(accessToken, config, key)
            deleted = deleted || variableDeleted
          } catch (error) {
            deletionErrors.push({
              key,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }

          if (deleted) {
            deletedCount++
          }
        }

        for (const entry of syncEntries) {
          try {
            if (entry.syncAsSecret) {
              // Ensure key does not remain as a GitHub variable when mode maps it to secret.
              try {
                await deleteVariable(accessToken, config, entry.syncKey)
              } catch (cleanupError) {
                result.errors.push({
                  key: entry.key,
                  error: cleanupError instanceof Error ? `Cleanup variable failed: ${cleanupError.message}` : 'Cleanup variable failed'
                })
              }

              if (publicKey) {
                await syncSecret(accessToken, config, entry.syncKey, entry.value, publicKey)
                result.secrets_synced++
                console.log(`[github-sync queue] Synced secret: ${entry.syncKey}`)
              } else {
                throw new Error('Missing GitHub public key for secret sync')
              }
            } else {
              // Ensure key does not remain as a GitHub secret when mode maps it to variable.
              try {
                await deleteSecret(accessToken, config, entry.syncKey)
              } catch (cleanupError) {
                result.errors.push({
                  key: entry.key,
                  error: cleanupError instanceof Error ? `Cleanup secret failed: ${cleanupError.message}` : 'Cleanup secret failed'
                })
              }

              await syncVariable(accessToken, config, entry.syncKey, entry.value)
              result.variables_synced++
              console.log(`[github-sync queue] Synced variable: ${entry.syncKey}`)
            }
          } catch (err) {
            console.error(`[github-sync queue] Failed to sync ${entry.key}:`, err)
            result.errors.push({
              key: entry.key,
              error: err instanceof Error ? err.message : 'Unknown error'
            })
          }
        }
      }

      if (deletionErrors.length > 0) {
        result.errors.push(...deletionErrors)
      }

      const status = result.errors.length === 0
        ? 'success'
        : (result.variables_synced + result.secrets_synced > 0 ? 'partial' : 'failed')

      await serviceClient.rpc('record_github_sync_v11', {
        p_env_config_id: item.env_config_id,
        p_triggered_by: null,
        p_trigger_type: 'auto',
        p_variables_synced: result.variables_synced,
        p_secrets_synced: result.secrets_synced,
        p_status: status,
        p_error_message: result.errors.length > 0 ? result.errors[0].error : null,
        p_details: {
          synced_keys: syncedKeys,
          deleted_keys: keysToDeleteList,
          deleted_count: deletedCount,
          deletion_errors: deletionErrors,
          errors: result.errors,
          trigger_reason: item.trigger_reason
        }
      })

      // Mark queue item as completed
      await serviceClient.rpc('mark_sync_completed', { p_pending_sync_id: item.pending_sync_id })

      console.log(`[github-sync queue] Completed: ${result.variables_synced} vars, ${result.secrets_synced} secrets, ${result.errors.length} errors`)

      results.push({
        env_config_id: item.env_config_id,
        status,
        error: result.errors.length > 0 ? result.errors[0].error : undefined
      })
      processed++

    } catch (err) {
      console.error('[github-sync] Queue processing error:', err)
      await serviceClient.rpc('mark_sync_failed', {
        p_pending_sync_id: item.pending_sync_id,
        p_error: err instanceof Error ? err.message : 'Unknown error'
      })
      results.push({
        env_config_id: item.env_config_id,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }

  console.log(`[github-sync] Processed ${processed} queue items`)
  return jsonResponse({ processed, results }, corsHeaders)
}

// =====================================================
// Main Handler
// =====================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  // Create Supabase clients
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Check if this is a queue processing request
  const url = new URL(req.url)
  if (url.pathname.endsWith('/process-queue')) {
    // Queue processing requires service role auth (internal call)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    return processAutoSyncQueue(serviceClient, corsHeaders)
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return unauthorizedResponse(corsHeaders, 'Missing authorization')
    }

    // User client (for RLS-protected queries)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Service client (for privileged operations)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return unauthorizedResponse(corsHeaders, 'Invalid authentication')
    }

    // Parse request
    const body: SyncRequest = await req.json()
    const { env_config_id, trigger_type } = body

    if (!trigger_type || !env_config_id) {
      return errorResponse('Missing required fields: trigger_type and env_config_id', corsHeaders, 400)
    }

    const result = await handleV11Sync(serviceClient, userClient, user.id, env_config_id, trigger_type)

    return jsonResponse(result, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
