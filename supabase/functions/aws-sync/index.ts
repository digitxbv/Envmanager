// AWS Secrets Manager Sync Edge Function
// Syncs environment variables from EnvManager to AWS Secrets Manager
//
// POST /aws-sync
// Body: { env_config_id: string, trigger_type: 'auto' | 'manual' }
// Returns: SyncResult
//
// POST /aws-sync/process-queue (service role only)
// Processes pending auto-sync queue items

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logError } from '../_shared/logger.js'
import { applyPrefix } from '../_shared/prefix.js'
import { signAwsRequest } from '../_shared/cloud-auth.ts'
import { sanitizeSecretName } from '../_shared/cloud-naming.ts'
import { requireEnv } from '../_shared/require-env.ts'

interface SyncRequest {
  env_config_id: string
  trigger_type: 'auto' | 'manual'
}

interface SyncResult {
  success: boolean
  status: 'success' | 'partial' | 'failed'
  variables_synced: number
  secrets_synced: number
  variables_deleted?: number
  errors?: Array<{ key: string; error: string }>
}

async function upsertAwsSecret(
  accessKeyId: string,
  secretKey: string,
  region: string,
  secretName: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const endpoint = `https://secretsmanager.${region}.amazonaws.com/`
  const body = JSON.stringify({ SecretId: secretName, SecretString: value })

  const headers = await signAwsRequest(accessKeyId, secretKey, region, 'secretsmanager', {
    method: 'POST',
    url: endpoint,
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': 'secretsmanager.PutSecretValue'
    },
    body
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'secretsmanager.PutSecretValue'
    },
    body
  })

  if (!res.ok) {
    const responseBody = await res.text()

    // Parse AWS JSON error response to check __type
    let isNotFound = false
    try {
      const parsed = JSON.parse(responseBody)
      isNotFound = parsed.__type?.includes('ResourceNotFoundException')
    } catch {
      isNotFound = responseBody.includes('ResourceNotFoundException')
    }

    // Fall back to CreateSecret if not found
    if (isNotFound) {
      const createBody = JSON.stringify({ Name: secretName, SecretString: value })

      const createHeaders = await signAwsRequest(accessKeyId, secretKey, region, 'secretsmanager', {
        method: 'POST',
        url: endpoint,
        headers: {
          'content-type': 'application/x-amz-json-1.1',
          'x-amz-target': 'secretsmanager.CreateSecret'
        },
        body: createBody
      })

      const createRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...createHeaders,
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'secretsmanager.CreateSecret'
        },
        body: createBody
      })

      if (!createRes.ok) {
        const createResponseBody = await createRes.text()
        logError(new Error(`Failed to create secret: ${createRes.status}`), { functionName: 'aws-sync', context: 'create_secret', secretName, responseBody: createResponseBody })
        return { success: false, error: 'Failed to create secret in AWS' }
      }

      return { success: true }
    }

    logError(new Error(`Failed to set secret: ${res.status}`), { functionName: 'aws-sync', context: 'put_secret_value', secretName, responseBody })
    return { success: false, error: 'Failed to set secret in AWS' }
  }

  return { success: true }
}

async function deleteAwsSecret(
  accessKeyId: string,
  secretKey: string,
  region: string,
  secretName: string
): Promise<{ success: boolean; error?: string }> {
  const endpoint = `https://secretsmanager.${region}.amazonaws.com/`
  const body = JSON.stringify({ SecretId: secretName, ForceDeleteWithoutRecovery: true })

  const headers = await signAwsRequest(accessKeyId, secretKey, region, 'secretsmanager', {
    method: 'POST',
    url: endpoint,
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': 'secretsmanager.DeleteSecret'
    },
    body
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'secretsmanager.DeleteSecret'
    },
    body
  })

  // 404/ResourceNotFoundException is fine (already deleted)
  if (!res.ok) {
    const responseBody = await res.text()
    let isNotFound = false
    try {
      const parsed = JSON.parse(responseBody)
      isNotFound = parsed.__type?.includes('ResourceNotFoundException')
    } catch {
      isNotFound = responseBody.includes('ResourceNotFoundException')
    }
    if (isNotFound) {
      return { success: true }
    }
    logError(new Error(`Delete failed: ${res.status}`), { functionName: 'aws-sync', context: 'delete_secret', secretName, responseBody })
    return { success: false, error: 'Failed to delete secret from AWS' }
  }

  return { success: true }
}

async function deleteFromAws(
  accessKeyId: string,
  secretKey: string,
  region: string,
  keysToDelete: string[]
): Promise<{ deleted: number; errors: Array<{ key: string; error: string }> }> {
  const errors: Array<{ key: string; error: string }> = []
  let deleted = 0

  if (keysToDelete.length === 0) return { deleted: 0, errors: [] }

  console.log(`[aws-sync] Deleting ${keysToDelete.length} removed secrets from AWS Secrets Manager`)

  for (const key of keysToDelete) {
    const result = await deleteAwsSecret(accessKeyId, secretKey, region, key)
    if (result.success) {
      deleted++
    } else {
      errors.push({ key, error: result.error || 'Unknown error' })
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

  // Check for queue processing endpoint
  const url = new URL(req.url)
  if (url.pathname.endsWith('/process-queue')) {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
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

    if (!['auto', 'manual'].includes(trigger_type)) {
      return errorResponse('Invalid trigger_type. Must be "auto" or "manual"', corsHeaders, 400)
    }

    console.log(`[aws-sync] Starting sync for env config ${env_config_id}, trigger: ${trigger_type}`)

    // Get environment integration config (RLS ensures access)
    const { data: envConfig, error: configError } = await userClient
      .from('environment_integration_configs')
      .select(`
        *,
        integration:platform_integrations!project_integration_id(
          id,
          platform,
          api_token_vault_id,
          metadata,
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

    // Get AWS Secrets Manager config from integration metadata
    const metadata = integration.metadata as { access_key_id?: string; region?: string } | null
    const accessKeyId = metadata?.access_key_id
    const region = metadata?.region
    if (!accessKeyId || !region) {
      return errorResponse('AWS Secrets Manager configuration incomplete (access_key_id, region required)', corsHeaders, 400)
    }

    console.log(`[aws-sync] Target AWS region: ${region}, prefix: ${envConfig.prefix || 'none'}`)

    // Get secret access key from Vault
    const { data: secretAccessKey, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: integration.api_token_vault_id })

    if (vaultError || !secretAccessKey) {
      logError(vaultError, { functionName: 'aws-sync', context: 'get_vault_secret' })
      return errorResponse('Failed to retrieve credentials', corsHeaders, 500)
    }

    // Get variables for this environment
    const { data: variables, error: varsError } = await serviceClient
      .rpc('get_variables_for_sync', {
        p_environment_id: envConfig.environment_id,
        p_sync_secrets: true,
        p_sync_variables: true,
        p_include_fallbacks: false,
        ...(envConfig.service_id && { p_service_id: envConfig.service_id })
      })

    if (varsError) {
      logError(varsError, { functionName: 'aws-sync', context: 'get_variables_for_sync' })
      return errorResponse('Failed to get variables', corsHeaders, 500)
    }

    // Apply prefix and sanitize names for AWS
    const processedVars = (variables || []).map((v: any) => {
      const prefixedKey = applyPrefix(v.key, envConfig.prefix)
      const sanitizedName = sanitizeSecretName(prefixedKey, 'aws')
      return {
        name: sanitizedName,
        value: v.value,
        is_secret: v.is_secret
      }
    })

    const syncedKeys = processedVars.map((v: any) => v.name)

    console.log(`[aws-sync] Syncing ${processedVars.length} vars:`, processedVars.map((v: any) => v.name))

    // Track synced keys and get keys to delete
    const { data: keysToDelete, error: trackError } = await serviceClient
      .rpc('update_synced_keys', {
        p_sync_config_id: env_config_id,
        p_synced_keys: syncedKeys
      })

    if (trackError) {
      console.warn('[aws-sync] Failed to update synced keys tracking:', trackError)
      // Continue with sync, deletion tracking is non-critical
    }

    // Handle deletion of removed variables first
    let deletionResult = { deleted: 0, errors: [] as Array<{ key: string; error: string }> }
    if (keysToDelete && keysToDelete.length > 0) {
      deletionResult = await deleteFromAws(accessKeyId, secretAccessKey, region, keysToDelete)
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

    // Upsert each variable to AWS Secrets Manager
    const errors: Array<{ key: string; error: string }> = []
    let variablesSynced = 0
    let secretsSynced = 0

    for (const v of processedVars) {
      const result = await upsertAwsSecret(accessKeyId, secretAccessKey, region, v.name, v.value)
      if (result.success) {
        if (v.is_secret) {
          secretsSynced++
        } else {
          variablesSynced++
        }
      } else {
        errors.push({ key: v.name, error: result.error || 'Unknown error' })
      }
    }

    // Combine all errors
    const allErrors = [...deletionResult.errors, ...errors]
    const hasErrors = allErrors.length > 0
    const totalSynced = variablesSynced + secretsSynced

    const syncResult: SyncResult = {
      success: totalSynced > 0,
      status: hasErrors ? (totalSynced > 0 ? 'partial' : 'failed') : 'success',
      variables_synced: variablesSynced,
      secrets_synced: secretsSynced,
      variables_deleted: deletionResult.deleted,
      errors: hasErrors ? allErrors : undefined
    }

    // Record history
    await serviceClient.rpc('record_platform_sync', {
      p_sync_config_id: env_config_id,
      p_triggered_by: user.id,
      p_trigger_type: trigger_type,
      p_variables_synced: variablesSynced,
      p_secrets_synced: secretsSynced,
      p_status: syncResult.status,
      p_error_message: hasErrors ? `${allErrors.length} sync errors` : null,
      p_details: {
        environment_id: envConfig.environment_id,
        prefix_used: envConfig.prefix,
        synced_keys: syncedKeys,
        deleted: deletionResult.deleted,
        sync_errors: hasErrors ? allErrors : undefined
      }
    })

    // Update last_synced_at
    await serviceClient
      .from('environment_integration_configs')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', env_config_id)

    console.log(`[aws-sync] Completed: ${variablesSynced} vars, ${secretsSynced} secrets, ${deletionResult.deleted} deleted${hasErrors ? `, ${allErrors.length} failed` : ''}`)

    return jsonResponse(syncResult, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})

// Process pending auto-sync queue items
async function processAutoSyncQueue(client: any, corsHeaders: HeadersInit) {
  console.log('[aws-sync] Processing auto-sync queue')

  const { data: queue, error } = await client.rpc('get_pending_platform_syncs', { p_limit: 10 })

  if (error) {
    logError(error, { functionName: 'aws-sync', context: 'get_pending_platform_syncs' })
    return jsonResponse({ processed: 0, error: error.message }, corsHeaders)
  }

  if (!queue || queue.length === 0) {
    console.log('[aws-sync] No pending syncs in queue')
    return jsonResponse({ processed: 0 }, corsHeaders)
  }

  console.log(`[aws-sync] Found ${queue.length} pending syncs`)

  let processed = 0
  for (const item of queue) {
    // Only process AWS syncs
    if (item.platform !== 'aws') continue

    try {
      console.log(`[aws-sync] Processing queue item ${item.queue_id} for config ${item.sync_config_id}`)

      const { data: envConfig, error: configError } = await client
        .from('environment_integration_configs')
        .select(`
          *,
          integration:platform_integrations!project_integration_id(
            id,
            platform,
            api_token_vault_id,
            metadata,
            disconnected_at,
            connected_by
          )
        `)
        .eq('id', item.sync_config_id)
        .single()

      if (configError || !envConfig) {
        console.warn(`[aws-sync] Config not found for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      if (!envConfig.enabled) {
        console.warn(`[aws-sync] Config disabled for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      const integration = envConfig.integration
      if (!integration || integration.disconnected_at) {
        console.warn(`[aws-sync] Connection inactive for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      const metadata = integration.metadata as { access_key_id?: string; region?: string } | null
      const accessKeyId = metadata?.access_key_id
      const region = metadata?.region
      if (!accessKeyId || !region) {
        console.warn(`[aws-sync] Incomplete AWS config in metadata for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      // Get secret access key from Vault
      const { data: secretAccessKey, error: vaultError } = await client
        .rpc('get_vault_secret', { secret_id: integration.api_token_vault_id })

      if (vaultError || !secretAccessKey) {
        logError(vaultError, { functionName: 'aws-sync', context: 'auto_sync_get_vault_secret' })
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

      // Apply prefix and sanitize names for AWS
      const processedVars = (variables || []).map((v: any) => {
        const prefixedKey = applyPrefix(v.key, envConfig.prefix)
        const sanitizedName = sanitizeSecretName(prefixedKey, 'aws')
        return { name: sanitizedName, value: v.value, is_secret: v.is_secret }
      })

      const syncedKeys = processedVars.map((v: any) => v.name)

      // Track synced keys and get deletions
      const { data: keysToDelete } = await client
        .rpc('update_synced_keys', {
          p_sync_config_id: item.sync_config_id,
          p_synced_keys: syncedKeys
        })

      // Handle deletions
      let deletionResult = { deleted: 0, errors: [] as Array<{ key: string; error: string }> }
      if (keysToDelete && keysToDelete.length > 0) {
        deletionResult = await deleteFromAws(accessKeyId, secretAccessKey, region, keysToDelete)
      }

      // Skip sync if no variables
      if (!variables || variables.length === 0) {
        console.log(`[aws-sync] No variables to sync for ${item.sync_config_id}`)

        await client.rpc('record_platform_sync', {
          p_sync_config_id: item.sync_config_id,
          p_triggered_by: integration.connected_by,
          p_trigger_type: 'auto',
          p_variables_synced: 0,
          p_secrets_synced: 0,
          p_status: deletionResult.errors.length > 0 ? 'partial' : 'success',
          p_error_message: deletionResult.errors.length > 0 ? `${deletionResult.errors.length} deletion errors` : null,
          p_details: {
            environment_id: envConfig.environment_id,
            prefix_used: envConfig.prefix,
            trigger_change: item.change_type,
            trigger_key: item.variable_key,
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

      // Upsert each variable to AWS Secrets Manager
      const syncErrors: Array<{ key: string; error: string }> = []
      let variablesSynced = 0
      let secretsSynced = 0

      for (const v of processedVars) {
        const result = await upsertAwsSecret(accessKeyId, secretAccessKey, region, v.name, v.value)
        if (result.success) {
          if (v.is_secret) secretsSynced++
          else variablesSynced++
        } else {
          syncErrors.push({ key: v.name, error: result.error || 'Unknown error' })
        }
      }

      const allErrors = [...deletionResult.errors, ...syncErrors]
      const hasErrors = allErrors.length > 0
      const totalSynced = variablesSynced + secretsSynced
      const status: 'success' | 'partial' | 'failed' = hasErrors
        ? (totalSynced > 0 ? 'partial' : 'failed')
        : 'success'

      await client.rpc('record_platform_sync', {
        p_sync_config_id: item.sync_config_id,
        p_triggered_by: integration.connected_by,
        p_trigger_type: 'auto',
        p_variables_synced: variablesSynced,
        p_secrets_synced: secretsSynced,
        p_status: status,
        p_error_message: hasErrors ? `${allErrors.length} sync errors` : null,
        p_details: {
          environment_id: envConfig.environment_id,
          prefix_used: envConfig.prefix,
          synced_keys: syncedKeys,
          deleted: deletionResult.deleted,
          sync_errors: hasErrors ? allErrors : undefined,
          trigger_change: item.change_type,
          trigger_key: item.variable_key
        }
      })

      if (status !== 'failed') {
        await client
          .from('environment_integration_configs')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', item.sync_config_id)
      }

      await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
      processed++

    } catch (err) {
      logError(err, { functionName: 'aws-sync', context: 'queue_processing', queueId: item.queue_id, syncConfigId: item.sync_config_id })
      // Record failed sync history but do NOT mark as processed so it can be retried
      try {
        await client.rpc('record_platform_sync', {
          p_sync_config_id: item.sync_config_id,
          p_triggered_by: item.triggered_by || null,
          p_trigger_type: 'auto',
          p_variables_synced: 0,
          p_secrets_synced: 0,
          p_status: 'failed',
          p_error_message: err instanceof Error ? err.message : 'Unknown error during queue processing',
          p_details: { queue_id: item.queue_id, error: 'Queue processing failed' }
        })
      } catch (recordErr) {
        logError(recordErr, { functionName: 'aws-sync', context: 'record_failed_sync' })
      }
    }
  }

  console.log(`[aws-sync] Processed ${processed} queue items`)
  return jsonResponse({ processed }, corsHeaders)
}
