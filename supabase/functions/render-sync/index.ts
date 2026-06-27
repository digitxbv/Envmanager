// Render Sync Edge Function
// Syncs environment variables from EnvManager to Render
// Uses per-variable upsert (safe, non-destructive) - NOT bulk replace
//
// POST /render-sync
// Body: { env_config_id: string, trigger_type: 'auto' | 'manual' }
// Returns: SyncResult
//
// POST /render-sync/process-queue (service role only)
// Processes pending auto-sync queue items

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logError } from '../_shared/logger.js'
import { applyPrefix } from '../_shared/prefix.js'
import { requireEnv } from '../_shared/require-env.ts'

const RENDER_API = 'https://api.render.com/v1'
const MAX_RETRIES = 5
const BASE_DELAY_MS = 1000

interface SyncRequest {
  env_config_id: string
  trigger_type: 'auto' | 'manual'
}

interface RenderTarget {
  owner_id: string
  owner_name: string
  target_type: 'service' | 'env_group'
  target_id: string
  target_name: string
}

interface SyncResult {
  success: boolean
  status: 'success' | 'partial' | 'failed'
  variables_synced: number
  secrets_synced: number
  variables_deleted?: number
  errors?: Array<{ key: string; error: string }>
}

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
      console.log(`[render-sync] Rate limited on ${context}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

// Upsert a single variable to Render (per-variable PUT - safe, non-destructive)
async function upsertVariable(
  token: string,
  targetType: 'service' | 'env_group',
  targetId: string,
  key: string,
  value: string
): Promise<void> {
  const basePath = targetType === 'service'
    ? `services/${targetId}`
    : `env-groups/${targetId}`
  const endpoint = `${RENDER_API}/${basePath}/env-vars/${encodeURIComponent(key)}`

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Render API error: ${response.status} - ${text}`)
  }
}

// Delete a single variable from Render
async function deleteVariable(
  token: string,
  targetType: 'service' | 'env_group',
  targetId: string,
  key: string
): Promise<void> {
  const basePath = targetType === 'service'
    ? `services/${targetId}`
    : `env-groups/${targetId}`
  const endpoint = `${RENDER_API}/${basePath}/env-vars/${encodeURIComponent(key)}`

  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  // 204 No Content or 404 are both acceptable for delete
  if (!response.ok && response.status !== 404) {
    const text = await response.text()
    throw new Error(`Render API error: ${response.status} - ${text}`)
  }
}

// Sync variables to Render target
async function syncToRenderTarget(
  token: string,
  target: RenderTarget,
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
          target.target_type,
          target.target_id,
          variable.key,
          variable.value
        ),
        `upsert ${variable.key}`
      )
      synced++
    } catch (err) {
      logError(err, { functionName: 'render-sync', context: `upsert ${variable.key}` })
      errors.push({ key: variable.key, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  // Delete removed variables
  for (const key of keysToDelete) {
    try {
      await withRetry(
        () => deleteVariable(
          token,
          target.target_type,
          target.target_id,
          key
        ),
        `delete ${key}`
      )
      deleted++
    } catch (err) {
      // 404 is acceptable for delete (already gone)
      const errorMsg = err instanceof Error ? err.message.toLowerCase() : ''
      if (!errorMsg.includes('not found') && !errorMsg.includes('404')) {
        logError(err, { functionName: 'render-sync', context: `delete ${key}` })
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

    console.log(`[render-sync] Starting sync for env_config ${env_config_id}, trigger: ${trigger_type}`)

    // Get environment integration config (RLS ensures access)
    const { data: envConfig, error: configError } = await userClient
      .from('environment_integration_configs')
      .select(`
        *,
        integration:platform_integrations!project_integration_id(*)
      `)
      .eq('id', env_config_id)
      .single()

    if (configError || !envConfig) {
      return errorResponse('Environment not configured for this integration. Please configure the environment first.', corsHeaders, 400)
    }

    const connection = envConfig.integration
    if (!connection || connection.disconnected_at) {
      return errorResponse('Render connection is not active', corsHeaders, 400)
    }

    // Parse target config (Render-specific)
    const target = envConfig.target_config as RenderTarget

    if (!target?.target_id) {
      return errorResponse('No Render target configured', corsHeaders, 400)
    }

    // Get token from Vault
    const { data: token, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: connection.api_token_vault_id })

    if (vaultError || !token) {
      logError(vaultError, { functionName: 'render-sync', context: 'get_vault_secret' })
      return errorResponse('Failed to retrieve credentials', corsHeaders, 500)
    }

    // Get variables for THIS environment
    const { data: variables, error: varsError } = await serviceClient
      .rpc('get_variables_for_sync', {
        p_environment_id: envConfig.environment_id,
        p_sync_secrets: true,
        p_sync_variables: true,
        p_include_fallbacks: false,
        ...(envConfig.service_id && { p_service_id: envConfig.service_id })
      })

    if (varsError) {
      logError(varsError, { functionName: 'render-sync', context: 'get_variables_for_sync' })
      return errorResponse('Failed to fetch variables', corsHeaders, 500)
    }

    // Apply prefix to all variables
    const prefixedVars = (variables || []).map((v: any) => ({
      ...v,
      key: applyPrefix(v.key, envConfig.prefix)
    }))

    // Track synced keys and get keys to delete
    const syncedKeys = prefixedVars.map((v: any) => v.key)
    const { data: keysToDelete, error: trackError } = await serviceClient
      .rpc('update_synced_keys', {
        p_sync_config_id: env_config_id,
        p_synced_keys: syncedKeys
      })

    if (trackError) {
      console.warn('[render-sync] Failed to update synced keys tracking:', trackError)
    }

    // Sync to Render
    const syncResult = await syncToRenderTarget(
      token,
      target,
      prefixedVars,
      keysToDelete || []
    )

    // Count results
    const secretsCount = prefixedVars.filter((v: any) => v.is_secret).length
    const varsCount = prefixedVars.length - secretsCount

    // Determine overall status
    const hasErrors = syncResult.errors.length > 0
    let status: 'success' | 'partial' | 'failed' = 'success'
    if (hasErrors && syncResult.synced === 0) {
      status = 'failed'
    } else if (hasErrors) {
      status = 'partial'
    }

    // Record history
    await serviceClient.rpc('record_platform_sync', {
      p_sync_config_id: env_config_id,
      p_triggered_by: user.id,
      p_trigger_type: trigger_type,
      p_variables_synced: varsCount,
      p_secrets_synced: secretsCount,
      p_status: status,
      p_error_message: hasErrors ? `${syncResult.errors.length} sync errors` : null,
      p_details: {
        environment_id: envConfig.environment_id,
        target: envConfig.target_config,
        prefix_used: envConfig.prefix,
        synced_keys: syncedKeys,
        deleted: syncResult.deleted,
        sync_errors: hasErrors ? syncResult.errors : undefined
      }
    })

    const result: SyncResult = {
      success: status !== 'failed',
      status,
      variables_synced: varsCount,
      secrets_synced: secretsCount,
      variables_deleted: syncResult.deleted,
      errors: hasErrors ? syncResult.errors : undefined
    }

    console.log(`[render-sync] Completed: ${varsCount} vars, ${secretsCount} secrets, ${syncResult.deleted} deleted`)

    return jsonResponse(result, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})

// Process pending auto-sync queue items
// NOTE: This will need updating in Plan 03 to work with environment_integration_configs
async function processAutoSyncQueue(client: any, corsHeaders: HeadersInit) {
  console.log('[render-sync] Processing auto-sync queue')

  // Get pending queue items
  const { data: queue, error } = await client.rpc('get_pending_platform_syncs', { p_limit: 10 })

  if (error) {
    logError(error, { functionName: 'render-sync', context: 'get_pending_platform_syncs' })
    return jsonResponse({ processed: 0, error: error.message }, corsHeaders)
  }

  if (!queue || queue.length === 0) {
    console.log('[render-sync] No pending syncs in queue')
    return jsonResponse({ processed: 0 }, corsHeaders)
  }

  console.log(`[render-sync] Found ${queue.length} pending syncs`)

  let processed = 0
  for (const item of queue) {
    // Only process Render syncs
    if (item.platform !== 'render') {
      continue
    }

    try {
      console.log(`[render-sync] Processing queue item ${item.queue_id}`)
      // TODO: Plan 03 will implement auto-sync queue processing with environment_integration_configs
      await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
      processed++
    } catch (err) {
      logError(err, { functionName: 'render-sync', context: 'queue_processing' })
      await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
    }
  }

  console.log(`[render-sync] Processed ${processed} queue items`)
  return jsonResponse({ processed }, corsHeaders)
}
