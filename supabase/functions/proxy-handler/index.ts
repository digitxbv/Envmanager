// =====================================================
// Proxy Handler Edge Function
// =====================================================
// Handles ALL hosted proxy requests from external apps.
// Validates caller token + origin, resolves secrets from
// vault, forwards request to target API, returns response.
//
// Auth: x-proxy-token header (NOT EnvManager user auth)
// Deploy with: supabase functions deploy proxy-handler --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logInfo, logError } from '../_shared/logger.js'

// =====================================================
// Types
// =====================================================

interface SecretMapping {
  variable_id: string
  inject_as: 'header' | 'body' | 'query'
  key: string
  template?: string
}

interface ProxyFunction {
  id: string
  organization_id: string
  enabled: boolean
  target_url: string
  http_method: string
  target_headers: Record<string, string>
  secret_mappings: SecretMapping[]
  secret_token: string
  allowed_origins: string[]
  request_body_template: Record<string, unknown> | null
  pass_through_body: boolean
  rate_limit_per_minute: number | null
}

interface RateLimitResult {
  allowed: boolean
  current: number
  limit: number
  remaining: number
  reset: number
}

// deno-lint-ignore no-explicit-any
type ServiceClient = ReturnType<typeof createClient<any>>

// =====================================================
// CORS Helpers (per-proxy, NOT shared cors.ts)
// =====================================================

function buildCorsHeaders(
  allowedOrigins: string[],
  requestOrigin: string | null,
  httpMethod: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': `${httpMethod}, OPTIONS`,
    'Access-Control-Allow-Headers': 'Content-Type, x-proxy-token',
    'Access-Control-Max-Age': '86400',
  }

  if (allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*'
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin
    headers['Vary'] = 'Origin'
  }

  return headers
}

// =====================================================
// Secret Resolution
// =====================================================

async function resolveSecrets(
  serviceClient: ServiceClient,
  mappings: SecretMapping[],
  organizationId: string,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>()
  if (mappings.length === 0) return resolved

  const variableIds = mappings.map((m) => m.variable_id)

  // Fetch variables with their vault_secret_id and environment_id for org verification
  const { data: variables, error: varError } = await serviceClient
    .from('variables')
    .select('id, vault_secret_id, environment_id')
    .in('id', variableIds)

  if (varError || !variables) {
    throw new Error('Failed to fetch variables for secret resolution')
  }

  if (variables.length !== variableIds.length) {
    throw new Error('Secret resolution failed: one or more variables not found')
  }

  // Verify all variables belong to the same organization via their environments
  const envIds = [...new Set(variables.map((v: { environment_id: string }) => v.environment_id))]
  const { data: envs, error: envError } = await serviceClient
    .from('environments')
    .select('id, project_id')
    .in('id', envIds)

  if (envError || !envs || envs.length !== envIds.length) {
    throw new Error('Secret resolution failed: environment lookup failed')
  }

  const projectIds = [...new Set(envs.map((e: { project_id: string }) => e.project_id))]
  const { data: projects, error: projError } = await serviceClient
    .from('projects')
    .select('id, organization_id')
    .in('id', projectIds)

  if (projError || !projects) {
    throw new Error('Secret resolution failed: project lookup failed')
  }

  const foreignProjects = projects.filter(
    (p: { organization_id: string }) => p.organization_id !== organizationId
  )
  if (foreignProjects.length > 0) {
    throw new Error('Secret resolution failed: variable does not belong to this organization')
  }

  // Decrypt all vault secrets in parallel for better latency
  const vaultEntries = variables.map(variable => {
    const v = variable as { id: string; vault_secret_id: string | null; environment_id: string }
    if (!v.vault_secret_id) {
      throw new Error(`Secret resolution failed: variable ${v.id} is not a secret (missing vault reference). Only secret variables can be used in proxy mappings.`)
    }
    return v
  })

  const decryptResults = await Promise.all(
    vaultEntries.map(v =>
      serviceClient.rpc('get_vault_secret', { secret_id: v.vault_secret_id })
    )
  )

  for (let i = 0; i < vaultEntries.length; i++) {
    const { data: decryptedValue, error: vaultError } = decryptResults[i]
    if (vaultError || decryptedValue === null || decryptedValue === undefined) {
      throw new Error('Secret resolution failed: decrypted value unavailable')
    }
    resolved.set(vaultEntries[i].id, decryptedValue as string)
  }

  return resolved
}

// =====================================================
// Request Builder
// =====================================================

function applyTemplate(template: string | undefined, value: string): string {
  if (!template) return value
  return template.replace('${value}', value)
}

function buildTargetUrl(
  baseUrl: string,
  queryMappings: SecretMapping[],
  resolvedSecrets: Map<string, string>,
): string {
  const url = new URL(baseUrl)
  for (const mapping of queryMappings) {
    const raw = resolvedSecrets.get(mapping.variable_id)!
    url.searchParams.set(mapping.key, applyTemplate(mapping.template, raw))
  }
  return url.toString()
}

function buildTargetHeaders(
  staticHeaders: Record<string, string>,
  headerMappings: SecretMapping[],
  resolvedSecrets: Map<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = { ...staticHeaders }
  for (const mapping of headerMappings) {
    const raw = resolvedSecrets.get(mapping.variable_id)!
    headers[mapping.key] = applyTemplate(mapping.template, raw)
  }
  return headers
}

function buildTargetBody(
  proxy: ProxyFunction,
  bodyMappings: SecretMapping[],
  resolvedSecrets: Map<string, string>,
  clientBody: unknown,
): unknown {
  // Start with client body or template
  let body: unknown
  if (proxy.request_body_template) {
    body = JSON.parse(JSON.stringify(proxy.request_body_template))
  } else if (proxy.pass_through_body && clientBody !== undefined) {
    body = clientBody
  } else {
    body = {}
  }

  // Merge body-injected secrets
  for (const mapping of bodyMappings) {
    const raw = resolvedSecrets.get(mapping.variable_id)!
    const value = applyTemplate(mapping.template, raw)
    if (typeof body === 'object' && body !== null) {
      ;(body as Record<string, unknown>)[mapping.key] = value
    }
  }

  return body
}

// =====================================================
// Billing Limit Lookup
// =====================================================

async function getMonthlyLimit(
  serviceClient: ServiceClient,
  organizationId: string,
): Promise<number> {
  const { data, error } = await serviceClient
    .from('organization_subscriptions')
    .select('plan_id, status, subscription_plans!inner(limits)')
    .eq('organization_id', organizationId)
    .single()

  if (error || !data) {
    // Default to free plan limit if lookup fails
    return 500
  }

  // Supabase returns joined relations; with .single() the inner join is an object
  const row = data as unknown as { plan_id: string; status: string; subscription_plans: { limits: Record<string, number> } }

  // Locked orgs get zero invocations — the hard-cap logic blocks everything
  if (row.status === 'paused') {
    return 0
  }

  return row.subscription_plans?.limits?.proxy_invocations_monthly ?? 500
}

// =====================================================
// Rate Limit Check (with 500ms timeout)
// =====================================================

async function checkRateLimit(
  serviceClient: ServiceClient,
  proxyId: string,
  rateLimitPerMinute: number,
): Promise<RateLimitResult | null> {
  const rpcPromise = serviceClient.rpc('check_and_increment_rate_limit', {
    p_proxy_function_id: proxyId,
    p_rate_limit: rateLimitPerMinute,
  })

  const RATE_LIMIT_TIMEOUT: RateLimitResult = { allowed: false, current: 0, limit: rateLimitPerMinute, remaining: 0, reset: Math.floor(Date.now() / 1000) + 60 }
  const timeoutPromise = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 500))

  try {
    const result = await Promise.race([rpcPromise, timeoutPromise])

    if (result === 'timeout') {
      // Timeout: fail closed — deny the request
      logError(new Error('Rate limit RPC timed out, denying request'), { proxy_id: proxyId, step: 'rate_limit_timeout' })
      return RATE_LIMIT_TIMEOUT
    }

    const { data, error } = result as { data: unknown; error: unknown }
    if (error || !data) {
      logError(error ?? new Error('Empty rate limit response'), { proxy_id: proxyId, step: 'rate_limit_check' })
      return RATE_LIMIT_TIMEOUT // Fail closed
    }

    return data as RateLimitResult
  } catch (err) {
    logError(err, { proxy_id: proxyId, step: 'rate_limit_check' })
    return RATE_LIMIT_TIMEOUT // Fail closed
  }
}

// =====================================================
// Main Handler
// =====================================================

serve(async (req) => {
  const startTime = Date.now()
  const requestOrigin = req.headers.get('origin')

  // Extract proxy_id from URL path
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  // Path: /proxy-handler/<proxy_id> or /functions/v1/proxy-handler/<proxy_id>
  const proxyId = pathParts[pathParts.length - 1]

  if (!proxyId || proxyId === 'proxy-handler') {
    return errorResponse('Proxy ID is required', {}, 404)
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(proxyId)) {
    return errorResponse('Not found', {}, 404)
  }

  // Set up service role client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return errorResponse('Server configuration error', {}, 500)
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Look up proxy config
  const { data: proxy, error: proxyError } = await serviceClient
    .from('proxy_functions')
    .select('*')
    .eq('id', proxyId)
    .single()

  if (proxyError || !proxy) {
    return errorResponse('Not found', {}, 404)
  }

  const proxyConfig = proxy as unknown as ProxyFunction
  const corsHeaders = buildCorsHeaders(proxyConfig.allowed_origins, requestOrigin, proxyConfig.http_method)

  // Handle OPTIONS preflight — validate origin before responding
  if (req.method === 'OPTIONS') {
    if (!proxyConfig.allowed_origins.includes('*')) {
      if (!requestOrigin || !proxyConfig.allowed_origins.includes(requestOrigin)) {
        return errorResponse('Origin not allowed', {}, 403)
      }
    }
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // Validate: request body size (1MB limit) — check header as early hint
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
      return errorResponse('Request body too large (max 1MB)', corsHeaders, 413)
    }

    // Validate: enabled
    if (!proxyConfig.enabled) {
      return errorResponse('Not found', corsHeaders, 404)
    }

    // Validate: token (timing-safe comparison)
    const proxyToken = req.headers.get('x-proxy-token')
    if (!proxyToken) {
      return errorResponse('Missing x-proxy-token header', corsHeaders, 401)
    }
    const encoder = new TextEncoder()
    const tokenBytes = encoder.encode(proxyToken)
    const expectedBytes = encoder.encode(proxyConfig.secret_token)
    if (tokenBytes.byteLength !== expectedBytes.byteLength ||
        !crypto.subtle.timingSafeEqual(tokenBytes, expectedBytes)) {
      return errorResponse('Invalid proxy token', corsHeaders, 401)
    }

    // Validate: origin
    if (!proxyConfig.allowed_origins.includes('*')) {
      if (!requestOrigin || !proxyConfig.allowed_origins.includes(requestOrigin)) {
        return errorResponse('Origin not allowed', corsHeaders, 403)
      }
    }

    // Validate: HTTP method
    if (req.method !== proxyConfig.http_method) {
      return errorResponse(`Method ${req.method} not allowed. Expected ${proxyConfig.http_method}`, corsHeaders, 405)
    }

    // [NEW] Rate limit check
    let rateLimitResult: RateLimitResult | null = null
    if (proxyConfig.rate_limit_per_minute !== null && proxyConfig.rate_limit_per_minute !== undefined) {
      rateLimitResult = await checkRateLimit(serviceClient, proxyConfig.id, proxyConfig.rate_limit_per_minute)

      if (rateLimitResult !== null && !rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.reset - Math.floor(Date.now() / 1000)
        const rateLimitHeaders = {
          ...corsHeaders,
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.reset),
          'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
        }
        // Fire-and-forget log for rate limited request
        serviceClient.from('proxy_invocation_logs').insert({
          proxy_function_id: proxyConfig.id,
          organization_id: proxyConfig.organization_id,
          status_code: 429,
          response_time_ms: Date.now() - startTime,
          error_type: 'rate_limited',
          origin: requestOrigin,
        }).then(null, (err: unknown) => console.error('Log insert failed:', err))
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', retry_after: Math.max(0, retryAfter) }),
          { status: 429, headers: { ...rateLimitHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // [MODIFIED] Invocation limit check (soft limit with 10x hard cap)
    const monthlyLimit = await getMonthlyLimit(serviceClient, proxyConfig.organization_id)
    const hardCap = monthlyLimit * 10
    const { data: invocationResult, error: rpcError } = await serviceClient.rpc('increment_proxy_invocation', {
      p_proxy_function_id: proxyConfig.id,
      p_organization_id: proxyConfig.organization_id,
      p_monthly_limit: monthlyLimit,
      p_hard_cap: hardCap,
    })

    if (rpcError) {
      logError(rpcError, { proxy_id: proxyConfig.id, step: 'increment_invocation' })
      return errorResponse('Failed to check invocation limit', corsHeaders, 500)
    }

    // Result: 'within_limit' | 'soft_exceeded' | 'hard_blocked'
    const limitStatus = invocationResult as string

    if (limitStatus === 'hard_blocked') {
      // 10x safety valve — counter was NOT incremented
      serviceClient.from('proxy_invocation_logs').insert({
        proxy_function_id: proxyConfig.id,
        organization_id: proxyConfig.organization_id,
        status_code: 429,
        response_time_ms: Date.now() - startTime,
        error_type: 'limit_exceeded',
        origin: requestOrigin,
      }).then(null, (err: unknown) => console.error('Log insert failed:', err))
      return new Response(
        JSON.stringify({ error: 'Monthly invocation limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    // 'within_limit' or 'soft_exceeded' — allow through (overage billed later)

    // Resolve secrets
    let resolvedSecrets: Map<string, string>
    try {
      resolvedSecrets = await resolveSecrets(serviceClient, proxyConfig.secret_mappings, proxyConfig.organization_id)
    } catch (err) {
      logError(err, { proxy_id: proxyConfig.id, step: 'secret_resolution' })
      return errorResponse('Failed to resolve proxy configuration', corsHeaders, 500)
    }

    // Categorize mappings
    const headerMappings = proxyConfig.secret_mappings.filter((m) => m.inject_as === 'header')
    const queryMappings = proxyConfig.secret_mappings.filter((m) => m.inject_as === 'query')
    const bodyMappings = proxyConfig.secret_mappings.filter((m) => m.inject_as === 'body')

    // Build target request
    const targetUrl = buildTargetUrl(proxyConfig.target_url, queryMappings, resolvedSecrets)
    const targetHeaders = buildTargetHeaders(proxyConfig.target_headers, headerMappings, resolvedSecrets)

    // Build body for methods that support it
    const fetchOptions: RequestInit = {
      method: proxyConfig.http_method,
      headers: targetHeaders,
    }

    if (['POST', 'PUT', 'DELETE'].includes(proxyConfig.http_method)) {
      let clientBody: unknown
      try {
        const bodyText = await req.text()
        if (bodyText.length > 1_048_576) {
          return errorResponse('Request body too large (max 1MB)', corsHeaders, 413)
        }
        if (bodyText) {
          clientBody = JSON.parse(bodyText)
        }
      } catch {
        // Non-JSON body or empty
        clientBody = undefined
      }

      const body = buildTargetBody(proxyConfig, bodyMappings, resolvedSecrets, clientBody)
      if (body !== undefined && Object.keys(body as Record<string, unknown>).length > 0) {
        fetchOptions.body = JSON.stringify(body)
        if (!targetHeaders['Content-Type'] && !targetHeaders['content-type']) {
          ;(fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json'
        }
      }
    }

    // Forward request with 25s timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    fetchOptions.signal = controller.signal

    let targetResponse: Response
    let targetErrorType: string | null = null
    try {
      targetResponse = await fetch(targetUrl, fetchOptions)
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        logInfo('Target API timeout', { proxy_id: proxyConfig.id, target_url: proxyConfig.target_url })
        // Fire-and-forget log for timeout
        serviceClient.from('proxy_invocation_logs').insert({
          proxy_function_id: proxyConfig.id,
          organization_id: proxyConfig.organization_id,
          status_code: 504,
          response_time_ms: Date.now() - startTime,
          error_type: 'timeout',
          origin: requestOrigin,
        }).then(null, (err: unknown) => console.error('Log insert failed:', err))
        return errorResponse('Gateway timeout: target API did not respond in time', corsHeaders, 504)
      }
      logError(err, { proxy_id: proxyConfig.id, step: 'target_fetch', target_url: proxyConfig.target_url })
      serviceClient.from('proxy_invocation_logs').insert({
        proxy_function_id: proxyConfig.id,
        organization_id: proxyConfig.organization_id,
        status_code: 502,
        response_time_ms: Date.now() - startTime,
        error_type: 'target_error',
        origin: requestOrigin,
      }).then(null, (err: unknown) => console.error('Log insert failed:', err))
      return errorResponse('Failed to reach target API', corsHeaders, 502)
    }
    clearTimeout(timeout)

    // Determine error type based on target response status
    if (targetResponse.status >= 500) {
      targetErrorType = 'target_error'
    }

    // Read response body
    const responseBody = await targetResponse.arrayBuffer()
    const responseContentType = targetResponse.headers.get('content-type')

    // Build response headers: CORS + original content-type + rate limit headers
    const responseHeaders: Record<string, string> = { ...corsHeaders }
    if (responseContentType) {
      responseHeaders['Content-Type'] = responseContentType
    }

    // [NEW] Add rate limit headers if rate limiting was checked
    if (rateLimitResult !== null) {
      responseHeaders['X-RateLimit-Limit'] = String(rateLimitResult.limit)
      responseHeaders['X-RateLimit-Remaining'] = String(rateLimitResult.remaining)
      responseHeaders['X-RateLimit-Reset'] = String(rateLimitResult.reset)
      responseHeaders['Access-Control-Expose-Headers'] = 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset'
    }

    const durationMs = Date.now() - startTime
    logInfo('Proxy invocation complete', {
      proxy_id: proxyConfig.id,
      target_url: proxyConfig.target_url,
      response_status: targetResponse.status,
      duration_ms: durationMs,
    })

    // [NEW] Fire-and-forget invocation log
    serviceClient.from('proxy_invocation_logs').insert({
      proxy_function_id: proxyConfig.id,
      organization_id: proxyConfig.organization_id,
      status_code: targetResponse.status,
      response_time_ms: durationMs,
      error_type: targetErrorType,
      origin: requestOrigin,
    }).then(null, (err: unknown) => console.error('Log insert failed:', err))

    return new Response(responseBody, {
      status: targetResponse.status,
      headers: responseHeaders,
    })
  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
