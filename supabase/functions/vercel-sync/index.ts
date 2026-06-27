// Vercel Sync Edge Function
// Syncs environment variables from EnvManager to Vercel
//
// POST /vercel-sync
// Body: { env_config_id: string, trigger_type: 'auto' | 'manual' }
// Returns: SyncResult
//
// POST /vercel-sync/process-queue (service role only)
// Processes pending auto-sync queue items

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logError } from '../_shared/logger.js'
import { applyPrefix } from '../_shared/prefix.js'
import { requireEnv } from '../_shared/require-env.ts'

interface SyncRequest {
  env_config_id: string
  trigger_type: 'auto' | 'manual'
}

interface VercelEnvVar {
  key: string
  value: string
  target: ('production' | 'preview' | 'development')[]
  type: 'encrypted' | 'plain' | 'sensitive'
  gitBranch?: string  // For preview environment branch filtering
}

interface SyncResult {
  success: boolean
  status: 'success' | 'partial' | 'failed'
  variables_synced: number
  secrets_synced: number
  variables_deleted?: number
  errors?: Array<{ key: string; error: string }>
}

// Delete variables from Vercel that were previously synced but no longer exist
async function deleteFromVercel(
  token: string,
  projectId: string,
  teamId: string | null,
  keysToDelete: string[]
): Promise<{ deleted: number; errors: Array<{ key: string; error: string }> }> {
  const errors: Array<{ key: string; error: string }> = []
  let deleted = 0

  if (keysToDelete.length === 0) {
    return { deleted: 0, errors: [] }
  }

  console.log(`[vercel-sync] Deleting ${keysToDelete.length} removed variables from Vercel`)

  // First, get all env vars from Vercel to find the IDs
  const queryParams = teamId ? `?teamId=${teamId}` : ''
  const listResponse = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/env${queryParams}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  if (!listResponse.ok) {
    console.log('[vercel-sync] Failed to list Vercel env vars for deletion')
    return { deleted: 0, errors: [{ key: 'list', error: 'Failed to fetch Vercel variables' }] }
  }

  const listData = await listResponse.json()
  const vercelEnvs = listData.envs || []

  for (const key of keysToDelete) {
    try {
      // Find the env var ID in Vercel
      const envVar = vercelEnvs.find((e: any) => e.key === key)

      if (!envVar) {
        // Already deleted or never existed in Vercel
        console.log(`[vercel-sync] Variable ${key} not found in Vercel (already deleted)`)
        deleted++
        continue
      }

      // Delete the variable
      const deleteResponse = await fetch(
        `https://api.vercel.com/v9/projects/${projectId}/env/${envVar.id}${queryParams}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (deleteResponse.ok || deleteResponse.status === 404) {
        console.log(`[vercel-sync] Deleted variable: ${key}`)
        deleted++
      } else {
        const errorText = await deleteResponse.text()
        console.log(`[vercel-sync] Failed to delete ${key}: ${deleteResponse.status}`)
        errors.push({ key, error: `Delete failed: ${deleteResponse.status}` })
      }

    } catch (err) {
      logError(err, { functionName: 'vercel-sync', context: `delete ${key}` })
      errors.push({ key, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return { deleted, errors }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  // Check if this is a queue processing request
  const url = new URL(req.url)
  if (url.pathname.endsWith('/process-queue')) {
    // Queue processing requires service role auth (internal call)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    return processAutoSyncQueue(serviceClient, corsHeaders)
  }

  const { user, userClient, serviceClient, error: authError } = await verifyAuth(
    req, supabaseUrl, supabaseAnonKey, supabaseServiceKey
  )

  if (authError || !user) {
    return unauthorizedResponse(corsHeaders, authError || 'Invalid authentication')
  }

  try {
    const body: SyncRequest = await req.json()
    const { env_config_id, trigger_type } = body

    if (!env_config_id || !trigger_type) {
      return errorResponse('Missing required fields', corsHeaders, 400)
    }

    console.log(`[vercel-sync] Starting sync for env config ${env_config_id}, trigger: ${trigger_type}`)

    // Get environment integration config (RLS ensures access)
    const { data: envConfig, error: configError } = await userClient
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
      .eq('id', env_config_id)
      .single()

    if (configError || !envConfig) {
      return errorResponse('Environment not configured for this integration. Please configure the environment first.', corsHeaders, 400)
    }

    if (!envConfig.enabled) {
      return errorResponse('Environment sync is disabled. Enable it in the integration settings.', corsHeaders, 400)
    }

    const integration = envConfig.integration
    if (!integration || integration.disconnected_at) {
      return errorResponse('Platform connection is no longer active', corsHeaders, 400)
    }

    // Parse target config
    const target = envConfig.target_config as {
      project_id: string
      project_name: string
      team_id: string | null
      // New structure: vercel_targets inside environment_mapping array
      environment_mapping?: Array<{
        envmanager_env: string
        vercel_targets: ('production' | 'preview' | 'development')[]
        git_branch?: string
      }>
      // Legacy flat fields (backwards compat)
      vercel_targets?: ('production' | 'preview' | 'development')[]
      git_branch?: string
    }

    if (!target.project_id) {
      return errorResponse('No Vercel project configured', corsHeaders, 400)
    }

    // Extract vercel_targets from environment_mapping or legacy flat field
    const mapping = target.environment_mapping?.[0]
    const vercelTargets = mapping?.vercel_targets || target.vercel_targets || ['production', 'preview', 'development']
    const gitBranch = mapping?.git_branch || target.git_branch

    console.log(`[vercel-sync] Target project: ${target.project_id}, Vercel targets: ${vercelTargets.join(', ')}, prefix: ${envConfig.prefix || 'none'}`)

    // Get token from Vault
    const { data: token, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: integration.api_token_vault_id })

    if (vaultError || !token) {
      logError(vaultError, { functionName: 'vercel-sync', context: 'get_vault_secret' })
      return errorResponse('Failed to retrieve credentials', corsHeaders, 500)
    }

    // Get variables for this environment
    const { data: variables, error: varsError } = await serviceClient
      .rpc('get_variables_for_sync', {
        p_environment_id: envConfig.environment_id,
        p_sync_secrets: true,  // Always sync both (config is per-env now)
        p_sync_variables: true,
        p_include_fallbacks: false,
        ...(envConfig.service_id && { p_service_id: envConfig.service_id })
      })

    if (varsError) {
      logError(varsError, { functionName: 'vercel-sync', context: 'get_variables_for_sync' })
      return errorResponse('Failed to get variables', corsHeaders, 500)
    }

    // Apply prefix to variables
    // Note: Vercel doesn't allow 'sensitive' type for 'development' target
    const isDevelopmentOnly = vercelTargets.length === 1 && vercelTargets[0] === 'development'
    const prefixedVars: VercelEnvVar[] = (variables || []).map((v: any) => {
      const prefixedKey = applyPrefix(v.key, envConfig.prefix)
      // Use 'encrypted' instead of 'sensitive' for development-only targets (Vercel limitation)
      const varType = v.is_secret
        ? (isDevelopmentOnly ? 'encrypted' : 'sensitive')
        : 'encrypted'
      const envVar: VercelEnvVar = {
        key: prefixedKey,
        value: v.value,
        target: vercelTargets,
        type: varType
      }
      // Add gitBranch for preview target filtering
      if (gitBranch && envVar.target.includes('preview')) {
        envVar.gitBranch = gitBranch
      }
      return envVar
    })

    const syncedKeys = prefixedVars.map(v => v.key)

    // Log what we're about to sync (keys only, not values)
    console.log(`[vercel-sync] Syncing ${prefixedVars.length} vars:`, prefixedVars.map(v => ({ key: v.key, type: v.type, target: v.target })))

    // Track synced keys and get keys to delete
    // Note: We track prefixed keys to ensure correct deletion
    const { data: keysToDelete, error: trackError } = await serviceClient
      .rpc('update_synced_keys', {
        p_sync_config_id: env_config_id,
        p_synced_keys: syncedKeys
      })

    if (trackError) {
      console.warn('[vercel-sync] Failed to update synced keys tracking:', trackError)
      // Continue with sync, deletion tracking is non-critical
    }

    // Handle deletion of removed variables first
    let deletionResult = { deleted: 0, errors: [] as Array<{ key: string; error: string }> }
    if (keysToDelete && keysToDelete.length > 0) {
      deletionResult = await deleteFromVercel(token, target.project_id, target.team_id, keysToDelete)
    }

    if (!variables || variables.length === 0) {
      // Record sync with only deletions
      await serviceClient.rpc('record_platform_sync', {
        p_sync_config_id: env_config_id,
        p_triggered_by: user.id,
        p_trigger_type: trigger_type,
        p_variables_synced: 0,
        p_secrets_synced: 0,
        p_status: deletionResult.errors.length > 0 ? 'partial' : 'success',
        p_error_message: deletionResult.errors.length > 0 ? `${deletionResult.errors.length} deletion errors` : null,
        p_details: {
          environment_id: envConfig.environment_id,
          target: envConfig.target_config,
          prefix_used: envConfig.prefix,
          message: 'No variables to sync',
          deleted: deletionResult.deleted,
          deletion_errors: deletionResult.errors
        }
      })

      // Update last_synced_at
      await serviceClient
        .from('environment_integration_configs')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', env_config_id)

      return jsonResponse({
        success: true,
        status: deletionResult.errors.length > 0 ? 'partial' : 'success',
        variables_synced: 0,
        secrets_synced: 0,
        variables_deleted: deletionResult.deleted,
        errors: deletionResult.errors.length > 0 ? deletionResult.errors : undefined
      }, corsHeaders)
    }

    // Sync to Vercel using upsert
    const queryParams = target.team_id ? `?teamId=${target.team_id}&upsert=true` : '?upsert=true'
    const syncResponse = await fetch(
      `https://api.vercel.com/v10/projects/${target.project_id}/env${queryParams}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prefixedVars)
      }
    )

    // Log the response for debugging
    const responseBody = await syncResponse.json().catch(() => ({}))
    console.log(`[vercel-sync] Vercel API response (${syncResponse.status}):`, JSON.stringify(responseBody))

    const result: SyncResult = {
      success: false,
      status: 'failed',
      variables_synced: 0,
      secrets_synced: 0,
      variables_deleted: deletionResult.deleted,
      errors: []
    }

    if (!syncResponse.ok) {
      const errorMsg = responseBody.error?.message || `Vercel API error: ${syncResponse.status}`
      console.log('[vercel-sync] Sync failed:', errorMsg)

      result.errors = [{ key: 'sync', error: errorMsg }, ...deletionResult.errors]
      await serviceClient.rpc('record_platform_sync', {
        p_sync_config_id: env_config_id,
        p_triggered_by: user.id,
        p_trigger_type: trigger_type,
        p_variables_synced: 0,
        p_secrets_synced: 0,
        p_status: 'failed',
        p_error_message: errorMsg,
        p_details: {
          environment_id: envConfig.environment_id,
          target: envConfig.target_config,
          prefix_used: envConfig.prefix,
          errors: result.errors,
          deleted: deletionResult.deleted
        }
      })

      return jsonResponse(result, corsHeaders)
    }

    // Check for partial failures from Vercel response
    const vercelFailed = responseBody.failed || []
    const vercelCreated = responseBody.created || []
    const vercelErrors = vercelFailed.map((f: any) => ({
      key: f.error?.envVarKey || 'unknown',
      error: f.error?.message || 'Unknown Vercel error'
    }))

    // Count synced vars based on what Vercel actually created
    const createdKeys = new Set(vercelCreated.map((c: any) => c.key))
    const actualSyncedSecrets = variables.filter((v: any) => v.is_secret && createdKeys.has(applyPrefix(v.key, envConfig.prefix))).length
    const actualSyncedVars = vercelCreated.length - actualSyncedSecrets

    // Combine all errors
    const allErrors = [...deletionResult.errors, ...vercelErrors]
    const hasErrors = allErrors.length > 0
    result.success = vercelCreated.length > 0
    result.status = hasErrors ? (vercelCreated.length > 0 ? 'partial' : 'failed') : 'success'
    result.variables_synced = actualSyncedVars
    result.secrets_synced = actualSyncedSecrets
    result.variables_deleted = deletionResult.deleted
    if (hasErrors) {
      result.errors = allErrors
    }

    // Record history
    await serviceClient.rpc('record_platform_sync', {
      p_sync_config_id: env_config_id,
      p_triggered_by: user.id,
      p_trigger_type: trigger_type,
      p_variables_synced: actualSyncedVars,
      p_secrets_synced: actualSyncedSecrets,
      p_status: result.status,
      p_error_message: hasErrors ? `${allErrors.length} sync errors` : null,
      p_details: {
        environment_id: envConfig.environment_id,
        target: envConfig.target_config,
        prefix_used: envConfig.prefix,
        synced_keys: Array.from(createdKeys),
        deleted: deletionResult.deleted,
        sync_errors: hasErrors ? allErrors : undefined
      }
    })

    // Update last_synced_at
    await serviceClient
      .from('environment_integration_configs')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', env_config_id)

    console.log(`[vercel-sync] Completed: ${actualSyncedVars} vars, ${actualSyncedSecrets} secrets, ${deletionResult.deleted} deleted${hasErrors ? `, ${allErrors.length} failed` : ''}`)

    return jsonResponse(result, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})

// Process pending auto-sync queue items
// Note: Auto-sync queue updates will be handled in Plan 03
async function processAutoSyncQueue(client: any, corsHeaders: HeadersInit) {
  console.log('[vercel-sync] Processing auto-sync queue')

  // Get pending queue items
  const { data: queue, error } = await client.rpc('get_pending_platform_syncs', { p_limit: 10 })

  if (error) {
    logError(error, { functionName: 'vercel-sync', context: 'get_pending_platform_syncs' })
    return jsonResponse({ processed: 0, error: error.message }, corsHeaders)
  }

  if (!queue || queue.length === 0) {
    console.log('[vercel-sync] No pending syncs in queue')
    return jsonResponse({ processed: 0 }, corsHeaders)
  }

  console.log(`[vercel-sync] Found ${queue.length} pending syncs`)

  let processed = 0
  for (const item of queue) {
    // Only process Vercel syncs
    if (item.platform !== 'vercel') {
      continue
    }

    try {
      console.log(`[vercel-sync] Processing queue item ${item.queue_id} for config ${item.sync_config_id}`)

      // Get environment integration config
      const { data: envConfig, error: configError } = await client
        .from('environment_integration_configs')
        .select(`
          *,
          integration:platform_integrations!project_integration_id(
            id,
            platform,
            api_token_vault_id,
            disconnected_at,
            connected_by
          )
        `)
        .eq('id', item.sync_config_id)
        .single()

      if (configError || !envConfig) {
        console.warn(`[vercel-sync] Config not found for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      if (!envConfig.enabled) {
        console.warn(`[vercel-sync] Config disabled for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      const integration = envConfig.integration
      if (!integration || integration.disconnected_at) {
        console.warn(`[vercel-sync] Connection inactive for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      // Get token
      const { data: token, error: vaultError } = await client
        .rpc('get_vault_secret', { secret_id: integration.api_token_vault_id })

      if (vaultError || !token) {
        logError(vaultError, { functionName: 'vercel-sync', context: 'auto_sync_get_token' })
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      // Get variables for this environment
      const { data: variables } = await client
        .rpc('get_variables_for_sync', {
          p_environment_id: envConfig.environment_id,
          p_sync_secrets: true,
          p_sync_variables: true,
          p_include_fallbacks: false,
          ...(envConfig.service_id && { p_service_id: envConfig.service_id })
        })

      // Parse target
      const target = envConfig.target_config as {
        project_id: string
        team_id: string | null
        environment_mapping?: Array<{
          envmanager_env: string
          vercel_targets: ('production' | 'preview' | 'development')[]
          git_branch?: string
        }>
        vercel_targets?: ('production' | 'preview' | 'development')[]
        git_branch?: string
      }

      // Extract vercel_targets from environment_mapping or legacy flat field
      const queueMapping = target.environment_mapping?.[0]
      const queueVercelTargets = queueMapping?.vercel_targets || target.vercel_targets || ['production', 'preview', 'development']
      const queueGitBranch = queueMapping?.git_branch || target.git_branch

      // Apply prefix
      // Note: Vercel doesn't allow 'sensitive' type for 'development' target
      const queueIsDevelopmentOnly = queueVercelTargets.length === 1 && queueVercelTargets[0] === 'development'
      const prefixedVars = (variables || []).map((v: any) => {
        const prefixedKey = applyPrefix(v.key, envConfig.prefix)
        const varType = v.is_secret
          ? (queueIsDevelopmentOnly ? 'encrypted' : 'sensitive')
          : 'encrypted'
        const envVar: any = {
          key: prefixedKey,
          value: v.value,
          target: queueVercelTargets,
          type: varType
        }
        if (queueGitBranch && envVar.target.includes('preview')) {
          envVar.gitBranch = queueGitBranch
        }
        return envVar
      })

      const syncedKeys = prefixedVars.map((v: any) => v.key)

      // Update synced keys tracking and get deletions
      const { data: keysToDelete } = await client
        .rpc('update_synced_keys', {
          p_sync_config_id: item.sync_config_id,
          p_synced_keys: syncedKeys
        })

      // Handle deletions
      let deletionResult = { deleted: 0, errors: [] as Array<{ key: string; error: string }> }
      if (keysToDelete && keysToDelete.length > 0) {
        deletionResult = await deleteFromVercel(token, target.project_id, target.team_id, keysToDelete)
      }

      // Skip sync if no variables
      if (!variables || variables.length === 0) {
        console.log(`[vercel-sync] No variables to sync for ${item.sync_config_id}`)

        const deletionOnlyStatus: 'success' | 'partial' = deletionResult.errors.length > 0 ? 'partial' : 'success'
        await client.rpc('record_platform_sync', {
          p_sync_config_id: item.sync_config_id,
          p_triggered_by: integration.connected_by,
          p_trigger_type: 'auto',
          p_variables_synced: 0,
          p_secrets_synced: 0,
          p_status: deletionOnlyStatus,
          p_error_message: deletionResult.errors.length > 0 ? `${deletionResult.errors.length} deletion errors` : null,
          p_details: {
            environment_id: envConfig.environment_id,
            target: envConfig.target_config,
            prefix_used: envConfig.prefix,
            trigger_change: item.change_type,
            trigger_key: item.variable_key,
            synced_keys: [],
            deleted: deletionResult.deleted,
            deletion_errors: deletionResult.errors
          }
        })

        await client
          .from('environment_integration_configs')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', item.sync_config_id)

        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        processed++
        continue
      }

      const queryParams = target.team_id ? `?teamId=${target.team_id}&upsert=true` : '?upsert=true'
      const syncResponse = await fetch(
        `https://api.vercel.com/v10/projects/${target.project_id}/env${queryParams}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(prefixedVars)
        }
      )

      const responseBody = await syncResponse.json().catch(() => ({}))

      const allErrors: Array<{ key: string; error: string }> = [...deletionResult.errors]
      let status: 'success' | 'partial' | 'failed' = 'success'
      let actualSyncedVars = 0
      let actualSyncedSecrets = 0
      let syncedKeysFromProvider: string[] = []

      if (!syncResponse.ok) {
        const errorMsg = responseBody.error?.message || `Auto-sync failed: ${syncResponse.status}`
        allErrors.push({ key: 'sync', error: errorMsg })
        status = deletionResult.deleted > 0 ? 'partial' : 'failed'
        console.log(`[vercel-sync] Auto-sync failed for ${item.sync_config_id}:`, responseBody)
      } else {
        const vercelFailed = responseBody.failed || []
        const vercelCreated = responseBody.created || []
        const vercelErrors = vercelFailed.map((f: any) => ({
          key: f.error?.envVarKey || 'unknown',
          error: f.error?.message || 'Unknown Vercel error'
        }))
        allErrors.push(...vercelErrors)

        syncedKeysFromProvider = vercelCreated.map((c: any) => c.key)
        const createdKeys = new Set(syncedKeysFromProvider)
        actualSyncedSecrets = (variables || []).filter((v: any) =>
          v.is_secret && createdKeys.has(applyPrefix(v.key, envConfig.prefix))
        ).length
        actualSyncedVars = vercelCreated.length - actualSyncedSecrets

        if (allErrors.length > 0) {
          const anySuccess = vercelCreated.length > 0 || deletionResult.deleted > 0
          status = anySuccess ? 'partial' : 'failed'
        }

        console.log(`[vercel-sync] Auto-sync completed for ${item.sync_config_id} with status ${status}`)
      }

      await client.rpc('record_platform_sync', {
        p_sync_config_id: item.sync_config_id,
        p_triggered_by: integration.connected_by,
        p_trigger_type: 'auto',
        p_variables_synced: actualSyncedVars,
        p_secrets_synced: actualSyncedSecrets,
        p_status: status,
        p_error_message: allErrors.length > 0 ? `${allErrors.length} sync errors` : null,
        p_details: {
          environment_id: envConfig.environment_id,
          target: envConfig.target_config,
          prefix_used: envConfig.prefix,
          synced_keys: syncedKeysFromProvider,
          deleted: deletionResult.deleted,
          sync_errors: allErrors.length > 0 ? allErrors : undefined,
          trigger_change: item.change_type,
          trigger_key: item.variable_key
        }
      })

      // Update last_synced_at
      if (status !== 'failed') {
        await client
          .from('environment_integration_configs')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', item.sync_config_id)
      }

      // Mark as processed
      await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
      processed++

    } catch (err) {
      logError(err, { functionName: 'vercel-sync', context: 'queue_processing' })
      await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
    }
  }

  console.log(`[vercel-sync] Processed ${processed} queue items`)
  return jsonResponse({ processed }, corsHeaders)
}
