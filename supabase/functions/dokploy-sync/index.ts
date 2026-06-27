// Dokploy Sync Edge Function
// Syncs environment variables from EnvManager to a Dokploy application
//
// POST /dokploy-sync
// Body: { env_config_id: string, trigger_type: 'auto' | 'manual' }
// Returns: SyncResult
//
// POST /dokploy-sync/process-queue (service role only)
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

type DokployServiceType = 'application' | 'compose' | 'mariadb' | 'mongo' | 'mysql' | 'postgres' | 'redis'

interface DokployTarget {
  project_id: string
  project_name: string
  service_id: string
  service_name: string
  service_type: DokployServiceType
}

interface SyncResult {
  success: boolean
  status: 'success' | 'partial' | 'failed'
  variables_synced: number
  secrets_synced: number
  errors?: Array<{ key: string; error: string }>
}

// Normalize Dokploy instance URL
function normalizeUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '')
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized
  }
  normalized = normalized.replace(/\/api$/, '')
  return normalized
}

// Create fetch function with optional CA certificate support
function createDokployFetch(caCert?: string): typeof fetch {
  if (caCert) {
    const client = Deno.createHttpClient({ caCerts: [caCert] })
    return (url: string | URL | Request, init?: RequestInit) =>
      fetch(url, { ...init, client } as RequestInit)
  }
  return fetch
}

// Parse env string (KEY=value format) into map
function parseEnvString(envStr: string | null | undefined): Map<string, string> {
  const result = new Map<string, string>()
  if (!envStr) return result

  // Handle both newline and quoted multiline values
  const lines = envStr.split('\n')
  let currentKey = ''
  let currentValue = ''
  let inQuotes = false

  for (const line of lines) {
    if (inQuotes) {
      currentValue += '\n' + line
      if (line.endsWith('"')) {
        inQuotes = false
        result.set(currentKey, currentValue.slice(1, -1)) // Remove quotes
      }
    } else {
      const eqIndex = line.indexOf('=')
      if (eqIndex > 0) {
        currentKey = line.slice(0, eqIndex).trim()
        currentValue = line.slice(eqIndex + 1)
        if (currentValue.startsWith('"') && !currentValue.endsWith('"')) {
          inQuotes = true
        } else if (currentValue.startsWith('"') && currentValue.endsWith('"')) {
          result.set(currentKey, currentValue.slice(1, -1))
        } else {
          result.set(currentKey, currentValue)
        }
      }
    }
  }
  return result
}

// Fetch existing env vars from Dokploy service
async function fetchExistingEnv(
  dokployFetch: typeof fetch,
  instanceUrl: string,
  token: string,
  targetId: string,
  targetType: DokployServiceType
): Promise<string | null> {
  const getEndpointMap: Record<DokployServiceType, { endpoint: string; idParam: string }> = {
    application: { endpoint: 'application.one', idParam: 'applicationId' },
    compose: { endpoint: 'compose.one', idParam: 'composeId' },
    mariadb: { endpoint: 'mariadb.one', idParam: 'mariadbId' },
    mongo: { endpoint: 'mongo.one', idParam: 'mongoId' },
    mysql: { endpoint: 'mysql.one', idParam: 'mysqlId' },
    postgres: { endpoint: 'postgres.one', idParam: 'postgresId' },
    redis: { endpoint: 'redis.one', idParam: 'redisId' },
  }

  const { endpoint, idParam } = getEndpointMap[targetType] || getEndpointMap.application

  try {
    const response = await dokployFetch(
      `${instanceUrl}/api/${endpoint}?${idParam}=${targetId}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-key': token
        }
      }
    )

    if (!response.ok) {
      console.log(`[dokploy-sync] Failed to fetch existing env: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.env || null
  } catch (err) {
    logError(err, { functionName: 'dokploy-sync', context: 'fetchExistingEnv' })
    return null
  }
}

// Sync variables to any Dokploy service type (with merge)
async function syncToDokploy(
  dokployFetch: typeof fetch,
  instanceUrl: string,
  token: string,
  targetId: string,
  targetType: DokployServiceType,
  newVars: Array<{ key: string; value: string }>
): Promise<{ success: boolean; error?: string }> {
  // 1. Fetch existing env vars
  const existingEnvStr = await fetchExistingEnv(dokployFetch, instanceUrl, token, targetId, targetType)
  const existingVars = parseEnvString(existingEnvStr)

  console.log(`[dokploy-sync] Existing vars: ${existingVars.size}, new vars: ${newVars.length}`)

  // 2. Merge: new vars override existing
  for (const v of newVars) {
    existingVars.set(v.key, v.value)
  }

  // 3. Format merged result
  const mergedEnvString = Array.from(existingVars.entries())
    .map(([key, value]) => {
      const val = value.includes('\n') ? `"${value}"` : value
      return `${key}=${val}`
    })
    .join('\n')

  // 4. Push merged result
  const saveEndpointMap: Record<DokployServiceType, { endpoint: string; idField: string }> = {
    application: { endpoint: 'application.saveEnvironment', idField: 'applicationId' },
    compose: { endpoint: 'compose.update', idField: 'composeId' },
    mariadb: { endpoint: 'mariadb.saveEnvironment', idField: 'mariadbId' },
    mongo: { endpoint: 'mongo.saveEnvironment', idField: 'mongoId' },
    mysql: { endpoint: 'mysql.saveEnvironment', idField: 'mysqlId' },
    postgres: { endpoint: 'postgres.saveEnvironment', idField: 'postgresId' },
    redis: { endpoint: 'redis.saveEnvironment', idField: 'redisId' },
  }

  const { endpoint, idField } = saveEndpointMap[targetType] || saveEndpointMap.application

  const body: Record<string, unknown> = {
    [idField]: targetId,
    env: mergedEnvString,
  }

  // Application type needs createEnvFile flag
  if (targetType === 'application') {
    body.createEnvFile = true
  }

  const response = await dokployFetch(`${instanceUrl}/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': token
    },
    body: JSON.stringify(body)
  })

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

    console.log(`[dokploy-sync] Starting sync for env_config ${env_config_id}, trigger: ${trigger_type}`)

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
      return errorResponse('Dokploy connection is not active', corsHeaders, 400)
    }

    // Parse target config (Dokploy-specific)
    const target = envConfig.target_config as DokployTarget

    if (!target?.service_id) {
      return errorResponse('No Dokploy service configured', corsHeaders, 400)
    }

    // Get instance_url from integration (not target)
    const rawInstanceUrl = connection.instance_url

    if (!rawInstanceUrl) {
      return errorResponse('Dokploy instance URL not configured', corsHeaders, 400)
    }

    const instanceUrl = normalizeUrl(rawInstanceUrl)

    // Get token from Vault
    const { data: token, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: connection.api_token_vault_id })

    if (vaultError || !token) {
      logError(vaultError, { functionName: 'dokploy-sync', context: 'get_vault_secret' })
      return errorResponse('Failed to retrieve credentials', corsHeaders, 500)
    }

    // Get CA cert from Vault if configured
    let caCert: string | undefined
    if (connection.ca_cert_vault_id) {
      const { data: certData } = await serviceClient
        .rpc('get_vault_secret', { secret_id: connection.ca_cert_vault_id })
      caCert = certData || undefined
    }

    const dokployFetch = createDokployFetch(caCert)

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
      logError(varsError, { functionName: 'dokploy-sync', context: 'get_variables_for_sync' })
      return errorResponse('Failed to fetch variables', corsHeaders, 500)
    }

    // Apply prefix to all variables
    const prefixedVars = (variables || []).map((v: any) => ({
      key: applyPrefix(v.key, envConfig.prefix),
      value: v.value,
      is_secret: v.is_secret
    }))

    // Sync to Dokploy (fetches existing, merges, then saves)
    const syncResult = await syncToDokploy(
      dokployFetch,
      instanceUrl,
      token,
      target.service_id,
      target.service_type || 'application',
      prefixedVars.map((v: any) => ({ key: v.key, value: v.value }))
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

    console.log(`[dokploy-sync] Completed: ${varsCount} vars, ${secretsCount} secrets, status: ${status}`)

    return jsonResponse(result, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})

// Process pending auto-sync queue items
// NOTE: This will need updating in Plan 03 to work with environment_integration_configs
async function processAutoSyncQueue(client: any, corsHeaders: HeadersInit) {
  console.log('[dokploy-sync] Processing auto-sync queue')

  // Get pending queue items
  const { data: queue, error } = await client.rpc('get_pending_platform_syncs', { p_limit: 10 })

  if (error) {
    logError(error, { functionName: 'dokploy-sync', context: 'get_pending_platform_syncs' })
    return jsonResponse({ processed: 0, error: error.message }, corsHeaders)
  }

  if (!queue || queue.length === 0) {
    console.log('[dokploy-sync] No pending syncs in queue')
    return jsonResponse({ processed: 0 }, corsHeaders)
  }

  console.log(`[dokploy-sync] Found ${queue.length} pending syncs`)

  let processed = 0
  for (const item of queue) {
    // Only process Dokploy syncs
    if (item.platform !== 'dokploy') {
      continue
    }

    try {
      console.log(`[dokploy-sync] Processing queue item ${item.queue_id}`)
      // TODO: Plan 03 will implement auto-sync queue processing with environment_integration_configs
      await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
      processed++
    } catch (err) {
      logError(err, { functionName: 'dokploy-sync', context: 'queue_processing' })
      await client.rpc('mark_platform_sync_processed', { p_queue_id: item.queue_id })
    }
  }

  console.log(`[dokploy-sync] Processed ${processed} queue items`)
  return jsonResponse({ processed }, corsHeaders)
}
