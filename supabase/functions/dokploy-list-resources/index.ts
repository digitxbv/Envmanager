// Dokploy List Resources Edge Function
// Lists projects and applications from a connected Dokploy instance
//
// POST /dokploy-list-resources
// Body: { connection_id: string }
// Returns: { projects: [...] }

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

// All Dokploy service types that can have environment variables
type DokployServiceType = 'application' | 'compose' | 'mariadb' | 'mongo' | 'mysql' | 'postgres' | 'redis'

interface DokployService {
  id: string
  name: string
  appName: string
  status: string
  type: DokployServiceType
}

interface DokployProject {
  id: string
  name: string
  services: DokployService[]  // Renamed from applications to services (includes all types)
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

    console.log('[dokploy-list-resources] Listing resources for connection:', connection_id)

    // Get connection (RLS ensures access)
    const { data: connection, error: connError } = await userClient
      .from('platform_integrations')
      .select('*')
      .eq('id', connection_id)
      .eq('platform', 'dokploy')
      .is('disconnected_at', null)
      .single()

    if (connError || !connection) {
      return notFoundResponse(corsHeaders, 'Dokploy connection not found')
    }

    // Get token from Vault
    const { data: token, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: connection.api_token_vault_id })

    if (vaultError || !token) {
      logError(vaultError, { functionName: 'dokploy-list-resources', context: 'get_vault_secret' })
      return errorResponse('Failed to retrieve credentials', corsHeaders, 500)
    }

    // Get instance URL from connection (direct column, not config JSONB)
    const rawInstanceUrl = connection.instance_url

    if (!rawInstanceUrl) {
      return errorResponse('Dokploy instance URL not configured', corsHeaders, 400)
    }

    const instanceUrl = normalizeUrl(rawInstanceUrl)
    // CA cert not yet supported - would need schema change
    const dokployFetch = createDokployFetch()

    // Call GET /api/project.all to list projects
    const response = await dokployFetch(`${instanceUrl}/api/project.all`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': token
      }
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.log('[dokploy-list-resources] API error:', response.status, errorText)

      if (response.status === 401 || response.status === 403) {
        return errorResponse('Authentication failed. Token may have expired.', corsHeaders, 401)
      }

      return errorResponse(`Failed to list projects: ${response.status}`, corsHeaders, 500)
    }

    const rawProjects = await response.json()

    // Parse and flatten the response for UI consumption
    // Structure: project → environments[] → applications/compose/databases
    const projects: DokployProject[] = rawProjects.map((p: any) => {
      const services: DokployService[] = []

      // Service type mappings: [arrayName, idField, statusField, type]
      const serviceTypes: Array<[string, string, string, DokployServiceType]> = [
        ['applications', 'applicationId', 'applicationStatus', 'application'],
        ['compose', 'composeId', 'composeStatus', 'compose'],
        ['mariadb', 'mariadbId', 'applicationStatus', 'mariadb'],
        ['mongo', 'mongoId', 'applicationStatus', 'mongo'],
        ['mysql', 'mysqlId', 'applicationStatus', 'mysql'],
        ['postgres', 'postgresId', 'applicationStatus', 'postgres'],
        ['redis', 'redisId', 'applicationStatus', 'redis'],
      ]

      // Iterate through all environments in the project
      for (const env of (p.environments || [])) {
        for (const [arrayName, idField, statusField, type] of serviceTypes) {
          if (env[arrayName]?.length) {
            for (const svc of env[arrayName]) {
              services.push({
                id: svc[idField],
                name: `${svc.name} (${env.name})`,  // Include env name for clarity
                appName: svc.appName || svc.name,
                status: svc[statusField] || 'unknown',
                type
              })
            }
          }
        }
      }

      return {
        id: p.projectId,
        name: p.name,
        services
      }
    })

    console.log('[dokploy-list-resources] Found', projects.length, 'projects')

    return jsonResponse({ projects }, corsHeaders)

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
