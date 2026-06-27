// Railway Sync Edge Function
// Syncs environment variables from EnvManager to Railway
//
// POST /railway-sync
// Body: { env_config_id: string, trigger_type: 'auto' | 'manual' }
// Returns: SyncResult
//
// POST /railway-sync/process-queue (service role only)
// Processes pending auto-sync queue items

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logError } from '../_shared/logger.js'
import { applyPrefix } from '../_shared/prefix.js'
import { requireEnv } from '../_shared/require-env.ts'

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const MAX_RETRIES = 5
const BASE_DELAY_MS = 1000

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

// GraphQL mutations
const VARIABLE_UPSERT_MUTATION = `
  mutation variableUpsert($input: VariableUpsertInput!) {
    variableUpsert(input: $input)
  }
`

const VARIABLE_DELETE_MUTATION = `
  mutation variableDelete($input: VariableDeleteInput!) {
    variableDelete(input: $input)
  }
`

// Retry wrapper with exponential backoff for rate limits
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      const errorMsg = lastError.message.toLowerCase()

      // Check if rate limited
      const isRateLimit = errorMsg.includes('429') ||
                          errorMsg.includes('rate limit') ||
                          errorMsg.includes('too many requests')

      if (!isRateLimit || attempt === MAX_RETRIES - 1) {
        throw lastError
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = BASE_DELAY_MS * Math.pow(2, attempt)
      console.log(`[railway-sync] Rate limited on ${context}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

async function railwayMutation(
  token: string,
  mutation: string,
  variables: Record<string, unknown>
): Promise<{ data?: any; errors?: Array<{ message: string }> }> {
  // IMPORTANT: Add ?source=envmanager to bypass Cloudflare 10 RPS hidden limit
  const response = await fetch(`${RAILWAY_API}?source=envmanager`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: mutation, variables })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Railway API error: ${response.status} - ${text}`)
  }

  return response.json()
}

// Upsert a single variable to Railway
async function upsertVariable(
  token: string,
  projectId: string,
  environmentId: string,
  serviceId: string | null,
  name: string,
  value: string
): Promise<void> {
  const input: Record<string, string> = {
    projectId,
    environmentId,
    name,
    value
  }

  // Only include serviceId if targeting a specific service (not shared variables)
  if (serviceId) {
    input.serviceId = serviceId
  }

  const result = await railwayMutation(token, VARIABLE_UPSERT_MUTATION, { input })

  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors[0].message)
  }
}

// Delete a single variable from Railway
async function deleteVariable(
  token: string,
  projectId: string,
  environmentId: string,
  serviceId: string | null,
  name: string
): Promise<void> {
  const input: Record<string, string> = {
    projectId,
    environmentId,
    name
  }

  // Only include serviceId if targeting a specific service (not shared variables)
  if (serviceId) {
    input.serviceId = serviceId
  }

  const result = await railwayMutation(token, VARIABLE_DELETE_MUTATION, { input })

  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors[0].message)
  }
}

// Sync variables to a single Railway environment
async function syncToRailwayEnvironment(
  token: string,
  projectId: string,
  railwayEnvId: string,
  serviceId: string | null,
  variables: Array<{ key: string; value: string; is_secret: boolean }>,
  keysToDelete: string[]
): Promise<{ synced: number; deleted: number; errors: Array<{ key: string; error: string }> }> {
  const errors: Array<{ key: string; error: string }> = []
  let synced = 0
  let deleted = 0

  // Upsert variables
  for (const variable of variables) {
    try {
      await withRetry(
        () => upsertVariable(
          token,
          projectId,
          railwayEnvId,
          serviceId,
          variable.key,
          variable.value
        ),
        `upsert ${variable.key}`
      )
      synced++
    } catch (err) {
      logError(err, { functionName: 'railway-sync', context: `upsert ${variable.key}` })
      errors.push({ key: variable.key, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  // Delete removed variables
  for (const key of keysToDelete) {
    try {
      await withRetry(
        () => deleteVariable(
          token,
          projectId,
          railwayEnvId,
          serviceId,
          key
        ),
        `delete ${key}`
      )
      deleted++
    } catch (err) {
      // 404 or "not found" is acceptable for delete
      const errorMsg = err instanceof Error ? err.message.toLowerCase() : ''
      if (!errorMsg.includes('not found') && !errorMsg.includes('404')) {
        logError(err, { functionName: 'railway-sync', context: `delete ${key}` })
        errors.push({ key, error: err instanceof Error ? err.message : 'Unknown error' })
      } else {
        deleted++ // Count as deleted even if already gone
      }
    }
  }

  return { synced, deleted, errors }
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

    console.log(`[railway-sync] Starting sync for env config ${env_config_id}, trigger: ${trigger_type}`)

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
      workspace_id: string
      service_id: string | null   // null = shared variables
      service_name: string | null
      // New structure: railway_env inside environment_mapping array
      environment_mapping?: Array<{
        envmanager_env: string
        railway_env_id: string
        railway_env_name: string
      }>
      // Legacy flat fields (backwards compat)
      railway_env_id?: string
      railway_env_name?: string
    }

    if (!target.project_id) {
      return errorResponse('No Railway project configured', corsHeaders, 400)
    }

    // Extract railway_env_id from environment_mapping or legacy flat field
    const mapping = target.environment_mapping?.[0]
    const railwayEnvId = mapping?.railway_env_id || target.railway_env_id
    const railwayEnvName = mapping?.railway_env_name || target.railway_env_name || ''

    if (!railwayEnvId) {
      return errorResponse('No Railway environment configured', corsHeaders, 400)
    }

    console.log(`[railway-sync] Target project: ${target.project_id}, Railway env: ${railwayEnvName} (${railwayEnvId})`)

    // Get token from Vault
    const { data: token, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: integration.api_token_vault_id })

    if (vaultError || !token) {
      logError(vaultError, { functionName: 'railway-sync', context: 'get_vault_secret' })
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
      logError(varsError, { functionName: 'railway-sync', context: 'get_variables_for_sync' })
      return errorResponse('Failed to get variables', corsHeaders, 500)
    }

    // Apply prefix to variables
    const prefixedVars = (variables || []).map((v: any) => ({
      ...v,
      key: applyPrefix(v.key, envConfig.prefix)
    }))

    const syncedKeys = prefixedVars.map((v: any) => v.key)

    // Track synced keys and get keys to delete
    const { data: keysToDelete, error: trackError } = await serviceClient
      .rpc('update_synced_keys', {
        p_sync_config_id: env_config_id,
        p_synced_keys: syncedKeys
      })

    if (trackError) {
      console.warn('[railway-sync] Failed to update synced keys tracking:', trackError)
    }

    // Sync to the single Railway environment
    const syncResult = await syncToRailwayEnvironment(
      token,
      target.project_id,
      railwayEnvId,
      target.service_id,
      prefixedVars,
      keysToDelete || []
    )

    // Count results
    const secretsCount = (variables || []).filter((v: any) => v.is_secret).length
    const varsCount = (variables || []).length - secretsCount

    // Determine overall status
    const hasErrors = syncResult.errors.length > 0
    const result: SyncResult = {
      success: !hasErrors || syncResult.synced > 0,
      status: hasErrors ? (syncResult.synced > 0 ? 'partial' : 'failed') : 'success',
      variables_synced: varsCount,
      secrets_synced: secretsCount,
      variables_deleted: syncResult.deleted,
      errors: hasErrors ? syncResult.errors : undefined
    }

    // Record history
    await serviceClient.rpc('record_platform_sync', {
      p_sync_config_id: env_config_id,
      p_triggered_by: user.id,
      p_trigger_type: trigger_type,
      p_variables_synced: varsCount,
      p_secrets_synced: secretsCount,
      p_status: result.status,
      p_error_message: hasErrors ? `${syncResult.errors.length} sync errors` : null,
      p_details: {
        environment_id: envConfig.environment_id,
        railway_env: railwayEnvName,
        target: envConfig.target_config,
        prefix_used: envConfig.prefix,
        synced_keys: syncedKeys,
        deleted: syncResult.deleted,
        sync_errors: hasErrors ? syncResult.errors : undefined
      }
    })

    // Update last_synced_at
    await serviceClient
      .from('environment_integration_configs')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', env_config_id)

    console.log(`[railway-sync] Completed: ${varsCount} vars, ${secretsCount} secrets, ${syncResult.deleted} deleted`)

    return jsonResponse(result, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})

// Process pending auto-sync queue items
// Note: Auto-sync queue updates will be handled in Plan 03
async function processAutoSyncQueue(client: any, corsHeaders: HeadersInit) {
  console.log('[railway-sync] Processing auto-sync queue')

  // Get pending queue items
  const { data: queue, error } = await client.rpc('get_pending_platform_syncs', { p_limit: 10 })

  if (error) {
    logError(error, { functionName: 'railway-sync', context: 'get_pending_platform_syncs' })
    return jsonResponse({ processed: 0, error: error.message }, corsHeaders)
  }

  if (!queue || queue.length === 0) {
    console.log('[railway-sync] No pending syncs in queue')
    return jsonResponse({ processed: 0 }, corsHeaders)
  }

  console.log(`[railway-sync] Found ${queue.length} pending syncs`)

  let processed = 0
  for (const item of queue) {
    // Only process Railway syncs
    if (item.platform !== 'railway') {
      continue
    }

    try {
      console.log(`[railway-sync] Processing queue item ${item.queue_id} for config ${item.sync_config_id}`)

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
        console.warn(`[railway-sync] Config not found for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      if (!envConfig.enabled) {
        console.warn(`[railway-sync] Config disabled for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      const integration = envConfig.integration
      if (!integration || integration.disconnected_at) {
        console.warn(`[railway-sync] Connection inactive for ${item.sync_config_id}`)
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      // Get token
      const { data: token, error: vaultError } = await client
        .rpc('get_vault_secret', { secret_id: integration.api_token_vault_id })

      if (vaultError || !token) {
        logError(vaultError, { functionName: 'railway-sync', context: 'auto_sync_get_token' })
        await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
        continue
      }

      // Parse target
      const target = envConfig.target_config as {
        project_id: string
        service_id: string | null
        environment_mapping?: Array<{
          envmanager_env: string
          railway_env_id: string
          railway_env_name: string
        }>
        railway_env_id?: string
        railway_env_name?: string
      }

      // Extract railway_env_id from environment_mapping or legacy flat field
      const queueMapping = target.environment_mapping?.[0]
      const queueRailwayEnvId = queueMapping?.railway_env_id || target.railway_env_id
      const queueRailwayEnvName = queueMapping?.railway_env_name || target.railway_env_name || ''

      // Skip if no Railway environment configured
      if (!queueRailwayEnvId) {
        console.warn(`[railway-sync] No Railway environment for ${item.sync_config_id}`)
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

      // Apply prefix
      const prefixedVars = (variables || []).map((v: any) => ({
        ...v,
        key: applyPrefix(v.key, envConfig.prefix)
      }))

      const syncedKeys = prefixedVars.map((v: any) => v.key)

      // Update synced keys tracking and get deletions
      const { data: keysToDelete } = await client
        .rpc('update_synced_keys', {
          p_sync_config_id: item.sync_config_id,
          p_synced_keys: syncedKeys
        })

      // Sync to Railway
      const syncResult = await syncToRailwayEnvironment(
        token,
        target.project_id,
        queueRailwayEnvId,
        target.service_id,
        prefixedVars,
        keysToDelete || []
      )

      // Count results
      const secretsCount = (variables || []).filter((v: any) => v.is_secret).length
      const varsCount = (variables || []).length - secretsCount
      const hasErrors = syncResult.errors.length > 0
      const status = hasErrors ? (syncResult.synced > 0 ? 'partial' : 'failed') : 'success'

      await client.rpc('record_platform_sync', {
        p_sync_config_id: item.sync_config_id,
        p_triggered_by: integration.connected_by,
        p_trigger_type: 'auto',
        p_variables_synced: varsCount,
        p_secrets_synced: secretsCount,
        p_status: status,
        p_error_message: hasErrors ? `${syncResult.errors.length} sync errors` : null,
        p_details: {
          environment_id: envConfig.environment_id,
          railway_env: queueRailwayEnvName,
          target: envConfig.target_config,
          prefix_used: envConfig.prefix,
          synced_keys: syncedKeys,
          deleted: syncResult.deleted,
          trigger_change: item.change_type,
          trigger_key: item.variable_key,
          sync_errors: hasErrors ? syncResult.errors : undefined
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
      logError(err, { functionName: 'railway-sync', context: 'queue_processing' })
      await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
    }
  }

  console.log(`[railway-sync] Processed ${processed} queue items`)
  return jsonResponse({ processed }, corsHeaders)
}
