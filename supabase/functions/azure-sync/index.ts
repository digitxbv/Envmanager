// Azure Key Vault Sync Edge Function
// Syncs environment variables from EnvManager to Azure Key Vault
//
// POST /azure-sync
// Body: { env_config_id: string, trigger_type: 'auto' | 'manual' }
// Returns: SyncResult
//
// POST /azure-sync/process-queue (service role only)
// Processes pending auto-sync queue items

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logError } from '../_shared/logger.js'
import { applyPrefix } from '../_shared/prefix.js'
import { getAzureAccessToken } from '../_shared/cloud-auth.ts'
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

async function upsertAzureSecret(
  accessToken: string,
  vaultUrl: string,
  secretName: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(
    `${vaultUrl}/secrets/${encodeURIComponent(secretName)}?api-version=7.4`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    }
  )

  if (!res.ok) {
    const body = await res.text()
    logError(new Error(`Failed to set secret: ${res.status} ${body}`), { functionName: 'azure-sync', context: 'upsertAzureSecret', secretName })
    return { success: false, error: `Failed to set secret: ${res.status}` }
  }

  return { success: true }
}

async function deleteAzureSecret(
  accessToken: string,
  vaultUrl: string,
  secretName: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(
    `${vaultUrl}/secrets/${encodeURIComponent(secretName)}?api-version=7.4`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  )

  // 404 is fine (already deleted)
  if (!res.ok && res.status !== 404) {
    const body = await res.text()
    logError(new Error(`Delete failed: ${res.status} ${body}`), { functionName: 'azure-sync', context: 'deleteAzureSecret', secretName })
    return { success: false, error: `Delete failed: ${res.status}` }
  }

  return { success: true }
}

async function deleteFromAzure(
  accessToken: string,
  vaultUrl: string,
  keysToDelete: string[]
): Promise<{ deleted: number; errors: Array<{ key: string; error: string }> }> {
  const errors: Array<{ key: string; error: string }> = []
  let deleted = 0

  if (keysToDelete.length === 0) return { deleted: 0, errors: [] }

  console.log(`[azure-sync] Deleting ${keysToDelete.length} removed secrets from Azure Key Vault`)

  for (const key of keysToDelete) {
    const result = await deleteAzureSecret(accessToken, vaultUrl, key)
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

    console.log(`[azure-sync] Starting sync for env config ${env_config_id}, trigger: ${trigger_type}`)

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

    // Get Azure Key Vault config from integration metadata
    const metadata = integration.metadata as { tenant_id?: string; client_id?: string; vault_url?: string } | null
    const tenantId = metadata?.tenant_id
    const clientId = metadata?.client_id
    const vaultUrl = metadata?.vault_url
    if (!tenantId || !clientId || !vaultUrl) {
      return errorResponse('Azure Key Vault configuration incomplete (tenant_id, client_id, vault_url required)', corsHeaders, 400)
    }

    console.log(`[azure-sync] Target Azure Key Vault: ${vaultUrl}, prefix: ${envConfig.prefix || 'none'}`)

    // Get client secret from Vault
    const { data: clientSecret, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: integration.api_token_vault_id })

    if (vaultError || !clientSecret) {
      logError(vaultError, { functionName: 'azure-sync', context: 'get_vault_secret' })
      return errorResponse('Failed to retrieve credentials', corsHeaders, 500)
    }

    // Get Azure access token
    let accessToken: string
    try {
      accessToken = await getAzureAccessToken(tenantId, clientId, clientSecret, 'https://vault.azure.net/.default')
    } catch (err) {
      logError(err, { functionName: 'azure-sync', context: 'getAzureAccessToken' })
      return errorResponse('Failed to authenticate with Azure', corsHeaders, 500)
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
      logError(varsError, { functionName: 'azure-sync', context: 'get_variables_for_sync' })
      return errorResponse('Failed to get variables', corsHeaders, 500)
    }

    // Apply prefix and sanitize names for Azure
    const processedVars = (variables || []).map((v: any) => {
      const prefixedKey = applyPrefix(v.key, envConfig.prefix)
      const sanitizedName = sanitizeSecretName(prefixedKey, 'azure')
      return {
        name: sanitizedName,
        value: v.value,
        is_secret: v.is_secret
      }
    })

    const syncedKeys = processedVars.map((v: any) => v.name)

    console.log(`[azure-sync] Syncing ${processedVars.length} vars:`, processedVars.map((v: any) => v.name))

    // Track synced keys and get keys to delete
    const { data: keysToDelete, error: trackError } = await serviceClient
      .rpc('update_synced_keys', {
        p_sync_config_id: env_config_id,
        p_synced_keys: syncedKeys
      })

    if (trackError) {
      console.warn('[azure-sync] Failed to update synced keys tracking:', trackError)
      // Continue with sync, deletion tracking is non-critical
    }

    // Handle deletion of removed variables first
    let deletionResult = { deleted: 0, errors: [] as Array<{ key: string; error: string }> }
    if (keysToDelete && keysToDelete.length > 0) {
      deletionResult = await deleteFromAzure(accessToken, vaultUrl, keysToDelete)
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

    // Upsert each variable to Azure Key Vault
    const errors: Array<{ key: string; error: string }> = []
    let variablesSynced = 0
    let secretsSynced = 0

    for (const v of processedVars) {
      const result = await upsertAzureSecret(accessToken, vaultUrl, v.name, v.value)
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

    console.log(`[azure-sync] Completed: ${variablesSynced} vars, ${secretsSynced} secrets, ${deletionResult.deleted} deleted${hasErrors ? `, ${allErrors.length} failed` : ''}`)

    return jsonResponse(syncResult, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})

// Process pending auto-sync queue items
async function processAutoSyncQueue(client: any, corsHeaders: HeadersInit) {
  console.log('[azure-sync] Processing auto-sync queue')

  const { data: queue, error } = await client.rpc('get_pending_platform_syncs', { p_limit: 10 })

  if (error) {
    logError(error, { functionName: 'azure-sync', context: 'get_pending_platform_syncs' })
    return jsonResponse({ processed: 0, error: error.message }, corsHeaders)
  }

  if (!queue || queue.length === 0) {
    console.log('[azure-sync] No pending syncs in queue')
    return jsonResponse({ processed: 0 }, corsHeaders)
  }

  console.log(`[azure-sync] Found ${queue.length} pending syncs`)

  let processed = 0
  for (const item of queue) {
    // Only process Azure syncs
    if (item.platform !== 'azure') continue

    try {
      console.log(`[azure-sync] Processing queue item ${item.queue_id} for config ${item.sync_config_id}`)

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
        console.warn(`[azure-sync] Config not found for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      if (!envConfig.enabled) {
        console.warn(`[azure-sync] Config disabled for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      const integration = envConfig.integration
      if (!integration || integration.disconnected_at) {
        console.warn(`[azure-sync] Connection inactive for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      const metadata = integration.metadata as { tenant_id?: string; client_id?: string; vault_url?: string } | null
      const tenantId = metadata?.tenant_id
      const clientId = metadata?.client_id
      const vaultUrl = metadata?.vault_url
      if (!tenantId || !clientId || !vaultUrl) {
        console.warn(`[azure-sync] Incomplete Azure config in metadata for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      // Get client secret from Vault
      const { data: clientSecret, error: vaultError } = await client
        .rpc('get_vault_secret', { secret_id: integration.api_token_vault_id })

      if (vaultError || !clientSecret) {
        logError(vaultError, { functionName: 'azure-sync', context: 'auto_sync_get_vault_secret' })
        continue
      }

      let accessToken: string
      try {
        accessToken = await getAzureAccessToken(tenantId, clientId, clientSecret, 'https://vault.azure.net/.default')
      } catch (err) {
        logError(err, { functionName: 'azure-sync', context: 'auto_sync_getAzureAccessToken' })
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

      // Apply prefix and sanitize names for Azure
      const processedVars = (variables || []).map((v: any) => {
        const prefixedKey = applyPrefix(v.key, envConfig.prefix)
        const sanitizedName = sanitizeSecretName(prefixedKey, 'azure')
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
        deletionResult = await deleteFromAzure(accessToken, vaultUrl, keysToDelete)
      }

      // Skip sync if no variables
      if (!variables || variables.length === 0) {
        console.log(`[azure-sync] No variables to sync for ${item.sync_config_id}`)

        await client.rpc('record_platform_sync', {
          p_sync_config_id: item.sync_config_id,
          p_triggered_by: null,
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

      // Upsert each variable to Azure Key Vault
      const syncErrors: Array<{ key: string; error: string }> = []
      let variablesSynced = 0
      let secretsSynced = 0

      for (const v of processedVars) {
        const result = await upsertAzureSecret(accessToken, vaultUrl, v.name, v.value)
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
        p_triggered_by: null,
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
      logError(err, { functionName: 'azure-sync', context: 'queue_processing' })
    }
  }

  console.log(`[azure-sync] Processed ${processed} queue items`)
  return jsonResponse({ processed }, corsHeaders)
}
