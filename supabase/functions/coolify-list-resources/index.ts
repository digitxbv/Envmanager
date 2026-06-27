// Coolify List Resources Edge Function
// Lists applications from a connected Coolify instance
//
// POST /coolify-list-resources
// Body: { connection_id: string }
// Returns: { applications: [...] }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logError } from '../_shared/logger.js'
import { requireEnv } from '../_shared/require-env.ts'

interface ListResourcesRequest {
  connection_id: string
}

interface CoolifyApplication {
  uuid: string
  name: string
  description: string
  status: string
  fqdn: string
}

interface CoolifyDatabase {
  uuid: string
  name: string
  type: string
  status: string
}

interface CoolifyService {
  uuid: string
  name: string
  description: string
  status: string
}

// Normalize Coolify instance URL
function normalizeUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '')
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized
  }
  // Remove /api/v1 suffix if present
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  // Verify authenticated user
  const { user, userClient, serviceClient, error: authError } = await verifyAuth(
    req, supabaseUrl, supabaseAnonKey, supabaseServiceKey
  )

  if (authError || !user) {
    return unauthorizedResponse(corsHeaders, authError || 'Invalid authentication')
  }

  try {
    const body: ListResourcesRequest = await req.json()
    const { connection_id } = body

    if (!connection_id) {
      return errorResponse('connection_id is required', corsHeaders, 400)
    }

    console.log('[coolify-list-resources] Listing resources for connection:', connection_id)

    // Get connection (RLS ensures access)
    const { data: connection, error: connError } = await userClient
      .from('platform_integrations')
      .select('*')
      .eq('id', connection_id)
      .eq('platform', 'coolify')
      .is('disconnected_at', null)
      .single()

    if (connError || !connection) {
      return notFoundResponse(corsHeaders, 'Coolify connection not found')
    }

    // Get token from Vault
    const { data: token, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: connection.api_token_vault_id })

    if (vaultError || !token) {
      logError(vaultError, { functionName: 'coolify-list-resources', context: 'get_vault_secret' })
      return errorResponse('Failed to retrieve credentials', corsHeaders, 500)
    }

    // Get instance URL and CA cert from connection
    const rawInstanceUrl = connection.instance_url

    if (!rawInstanceUrl) {
      return errorResponse('Coolify instance URL not configured', corsHeaders, 400)
    }

    const instanceUrl = normalizeUrl(rawInstanceUrl)

    // Get CA cert from Vault if configured
    let caCert: string | undefined
    if (connection.ca_cert_vault_id) {
      const { data: certData } = await serviceClient
        .rpc('get_vault_secret', { secret_id: connection.ca_cert_vault_id })
      caCert = certData || undefined
    }

    const coolifyFetch = createCoolifyFetch(caCert)

    const headers = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }

    // Fetch all three resource types in parallel
    const [appsResponse, dbsResponse, servicesResponse] = await Promise.all([
      coolifyFetch(`${instanceUrl}/api/v1/applications`, { method: 'GET', headers }),
      coolifyFetch(`${instanceUrl}/api/v1/databases`, { method: 'GET', headers }),
      coolifyFetch(`${instanceUrl}/api/v1/services`, { method: 'GET', headers })
    ])

    // Handle auth errors (check any response)
    if (appsResponse.status === 401 || appsResponse.status === 403) {
      return errorResponse('Authentication failed. Token may have expired.', corsHeaders, 401)
    }

    // Parse applications
    let applications: CoolifyApplication[] = []
    if (appsResponse.ok) {
      const rawApplications = await appsResponse.json()
      applications = (rawApplications || []).map((app: any) => ({
        uuid: app.uuid,
        name: app.name,
        description: app.description || '',
        status: app.status || 'unknown',
        fqdn: app.fqdn || ''
      }))
    } else {
      console.warn('[coolify-list-resources] Failed to fetch applications:', appsResponse.status)
    }

    // Parse databases
    let databases: CoolifyDatabase[] = []
    if (dbsResponse.ok) {
      const rawDatabases = await dbsResponse.json()
      databases = (rawDatabases || []).map((db: any) => ({
        uuid: db.uuid,
        name: db.name,
        type: db.type || 'unknown',
        status: db.status || 'unknown'
      }))
    } else {
      console.warn('[coolify-list-resources] Failed to fetch databases:', dbsResponse.status)
    }

    // Parse services
    let services: CoolifyService[] = []
    if (servicesResponse.ok) {
      const rawServices = await servicesResponse.json()
      services = (rawServices || []).map((svc: any) => ({
        uuid: svc.uuid,
        name: svc.name,
        description: svc.description || '',
        status: svc.status || 'unknown'
      }))
    } else {
      console.warn('[coolify-list-resources] Failed to fetch services:', servicesResponse.status)
    }

    console.log('[coolify-list-resources] Found', applications.length, 'applications,', databases.length, 'databases,', services.length, 'services')

    return jsonResponse({ applications, databases, services }, corsHeaders)

  } catch (error) {
    // Handle SSL errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      if (message.includes('certificate') || message.includes('ssl') ||
          message.includes('tls') || message.includes('unknown_issuer')) {
        return errorResponse('SSL certificate error. If using self-signed certificate, please reconfigure with CA certificate.', corsHeaders, 500)
      }
    }

    return handleError(error, corsHeaders)
  }
})
