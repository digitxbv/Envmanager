// Coolify Sync Edge Function
// Syncs environment variables from EnvManager to a Coolify application
//
// POST /coolify-sync
// Body: { env_config_id: string, trigger_type: 'auto' | 'manual' }
// Returns: SyncResult
//
// POST /coolify-sync/process-queue (service role only)
// Processes pending auto-sync queue items

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logError } from '../_shared/logger.js'
import { applyPrefix } from '../_shared/prefix.js'
import { requireEnv } from '../_shared/require-env.ts'

interface SyncRequest {
  env_config_id: string
  trigger_type: 'auto' | 'manual'
}

type ResourceType = 'application' | 'database' | 'service'

interface CoolifyTarget {
  resource_uuid: string
  resource_name: string
  resource_type: ResourceType
  include_build_vars: boolean
}

interface SyncResult {
  success: boolean
  status: 'success' | 'partial' | 'failed'
  variables_synced: number
  secrets_synced: number
  errors?: Array<{ key: string; error: string }>
}

// Normalize Coolify instance URL
function normalizeUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '')
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized
  }
  normalized = normalized.replace(/\/api(\/v1)?$/, '')
  return normalized
}

// Create fetch function with optional CA certificate support
function createCoolifyFetch(caCert?: string): typeof fetch {
  if (caCert) {
    const client = Deno.createHttpClient({ caCerts: [caCert] })
    return (url: string | URL | Request, init?: RequestInit) =>
      fetch(url, { ...init, client } as RequestInit)
  }
  return fetch
}

// Get the API endpoint path based on resource type
function getEnvsBulkEndpoint(resourceType: ResourceType, resourceUuid: string): string {
  switch (resourceType) {
    case 'database':
      return `/api/v1/databases/${resourceUuid}/envs/bulk`
    case 'service':
      return `/api/v1/services/${resourceUuid}/envs/bulk`
    default:
      return `/api/v1/applications/${resourceUuid}/envs/bulk`
  }
}

// Sync variables to Coolify resource using bulk endpoint
async function syncToCoolify(
  coolifyFetch: typeof fetch,
  instanceUrl: string,
  token: string,
  resourceUuid: string,
  resourceType: ResourceType,
  newVars: Array<{ key: string; value: string }>,
  includeBuildVars: boolean
): Promise<{ success: boolean; error?: string }> {
  const endpoint = getEnvsBulkEndpoint(resourceType, resourceUuid)

  const response = await coolifyFetch(
    `${instanceUrl}${endpoint}`,
    {
      method: 'PATCH',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        data: newVars.map(v => ({
          key: v.key,
          value: v.value,
          is_buildtime: includeBuildVars,  // User config from checkbox
          is_runtime: true,                 // Always runtime
          is_multiline: v.value.includes('\n')
        }))
      })
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    return {
      success: false,
      error: errorData.message || `Sync failed: ${response.status}`
    }
  }

  return { success: true }
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

    console.log(`[coolify-sync] Starting sync for env_config ${env_config_id}, trigger: ${trigger_type}`)

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
      return errorResponse('Coolify connection is not active', corsHeaders, 400)
    }

    // Parse target config (Coolify-specific)
    const target = envConfig.target_config as CoolifyTarget

    if (!target?.resource_uuid) {
      return errorResponse('No Coolify resource configured', corsHeaders, 400)
    }

    // Get instance_url from integration
    const rawInstanceUrl = connection.instance_url

    if (!rawInstanceUrl) {
      return errorResponse('Coolify instance URL not configured', corsHeaders, 400)
    }

    const instanceUrl = normalizeUrl(rawInstanceUrl)

    // Get token from Vault
    const { data: token, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: connection.api_token_vault_id })

    if (vaultError || !token) {
      logError(vaultError, { functionName: 'coolify-sync', context: 'get_vault_secret' })
      return errorResponse('Failed to retrieve credentials', corsHeaders, 500)
    }

    // Get CA cert from Vault if configured
    let caCert: string | undefined
    if (connection.ca_cert_vault_id) {
      const { data: certData } = await serviceClient
        .rpc('get_vault_secret', { secret_id: connection.ca_cert_vault_id })
      caCert = certData || undefined
    }

    const coolifyFetch = createCoolifyFetch(caCert)

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
      logError(varsError, { functionName: 'coolify-sync', context: 'get_variables_for_sync' })
      return errorResponse('Failed to fetch variables', corsHeaders, 500)
    }

    // Apply prefix to all variables
    const prefixedVars = (variables || []).map((v: any) => ({
      key: applyPrefix(v.key, envConfig.prefix),
      value: v.value,
      is_secret: v.is_secret
    }))

    // Sync to Coolify using bulk endpoint
    const syncResult = await syncToCoolify(
      coolifyFetch,
      instanceUrl,
      token,
      target.resource_uuid,
      target.resource_type || 'application',
      prefixedVars.map((v: any) => ({ key: v.key, value: v.value })),
      target.include_build_vars ?? false
    )

    // Count variables and secrets
    const secretsCount = prefixedVars.filter((v: any) => v.is_secret).length
    const varsCount = prefixedVars.length - secretsCount

    // Update synced_keys tracking
    const syncedKeys = prefixedVars.map((v: any) => v.key)
    await serviceClient.rpc('update_synced_keys', {
      p_sync_config_id: env_config_id,
      p_synced_keys: syncedKeys
    })

    // Determine status
    const allErrors: Array<{ key: string; error: string }> = []
    let status: 'success' | 'partial' | 'failed' = 'success'
    if (!syncResult.success) {
      status = 'failed'
      allErrors.push({ key: 'sync', error: syncResult.error || 'Unknown error' })
    }

    // Record history
    await serviceClient.rpc('record_platform_sync', {
      p_sync_config_id: env_config_id,
      p_triggered_by: user.id,
      p_trigger_type: trigger_type,
      p_variables_synced: varsCount,
      p_secrets_synced: secretsCount,
      p_status: status,
      p_error_message: allErrors.length > 0 ? `${allErrors.length} sync errors` : null,
      p_details: {
        environment_id: envConfig.environment_id,
        target: envConfig.target_config,
        prefix_used: envConfig.prefix,
        synced_keys: syncedKeys,
        sync_errors: allErrors.length > 0 ? allErrors : undefined
      }
    })

    const result: SyncResult = {
      success: syncResult.success,
      status,
      variables_synced: varsCount,
      secrets_synced: secretsCount,
      errors: allErrors.length > 0 ? allErrors : undefined
    }

    console.log(`[coolify-sync] Completed: ${varsCount} vars, ${secretsCount} secrets, status: ${status}`)

    return jsonResponse(result, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})

// Process pending auto-sync queue items
// NOTE: This will need updating in Plan 03 to work with environment_integration_configs
async function processAutoSyncQueue(client: any, corsHeaders: HeadersInit) {
  console.log('[coolify-sync] Processing auto-sync queue')

  // Get pending queue items
  const { data: queue, error } = await client.rpc('get_pending_platform_syncs', { p_limit: 10 })

  if (error) {
    logError(error, { functionName: 'coolify-sync', context: 'get_pending_platform_syncs' })
    return jsonResponse({ processed: 0, error: error.message }, corsHeaders)
  }

  if (!queue || queue.length === 0) {
    console.log('[coolify-sync] No pending syncs in queue')
    return jsonResponse({ processed: 0 }, corsHeaders)
  }

  console.log(`[coolify-sync] Found ${queue.length} pending syncs`)

  let processed = 0
  for (const item of queue) {
    // Only process Coolify syncs
    if (item.platform !== 'coolify') {
      continue
    }

    try {
      console.log(`[coolify-sync] Processing queue item ${item.queue_id}`)
      // TODO: Plan 03 will implement auto-sync queue processing with environment_integration_configs
      await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
      processed++
    } catch (err) {
      logError(err, { functionName: 'coolify-sync', context: 'queue_processing' })
      await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
    }
  }

  console.log(`[coolify-sync] Processed ${processed} queue items`)
  return jsonResponse({ processed }, corsHeaders)
}
