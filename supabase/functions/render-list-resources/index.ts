// Render List Resources Edge Function
// Lists services and env groups for a connected Render account
// Also supports creating new env groups
//
// GET (via POST body) /render-list-resources
// Body: { connection_id: string, owner_id: string }
// Returns: { services: [...], envGroups: [...] }
//
// POST /render-list-resources (create env group)
// Body: { connection_id: string, owner_id: string, name: string }
// Returns: { envGroup: { id, name } }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logError } from '../_shared/logger.js'
import { requireEnv } from '../_shared/require-env.ts'

const RENDER_API = 'https://api.render.com/v1'

interface ListResourcesRequest {
  connection_id: string
  owner_id: string
  name?: string  // Only for creating env group
}

interface RenderService {
  id: string
  name: string
  type: string
}

interface RenderEnvGroup {
  id: string
  name: string
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
    const { connection_id, owner_id, name } = body

    if (!connection_id) {
      return errorResponse('connection_id is required', corsHeaders, 400)
    }

    if (!owner_id) {
      return errorResponse('owner_id is required', corsHeaders, 400)
    }

    console.log('[render-list-resources] Request for connection:', connection_id, 'owner:', owner_id)

    // Get connection (RLS ensures access)
    const { data: connection, error: connError } = await userClient
      .from('platform_integrations')
      .select('*')
      .eq('id', connection_id)
      .eq('platform', 'render')
      .is('disconnected_at', null)
      .single()

    if (connError || !connection) {
      return notFoundResponse(corsHeaders, 'Render connection not found')
    }

    // Get token from Vault
    const { data: token, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: connection.api_token_vault_id })

    if (vaultError || !token) {
      logError(vaultError, { functionName: 'render-list-resources', context: 'get_vault_secret' })
      return errorResponse('Failed to retrieve credentials', corsHeaders, 500)
    }

    // Check if this is a create env group request (has name parameter)
    if (name) {
      console.log('[render-list-resources] Creating env group:', name)

      const createResponse = await fetch(`${RENDER_API}/env-groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, ownerId: owner_id })
      })

      if (!createResponse.ok) {
        const text = await createResponse.text()
        console.log('[render-list-resources] Failed to create env group:', createResponse.status, text)
        return errorResponse(`Failed to create env group: ${createResponse.status}`, corsHeaders, createResponse.status)
      }

      const createData = await createResponse.json()
      console.log('[render-list-resources] Created env group:', createData.id)

      return jsonResponse({
        envGroup: {
          id: createData.id,
          name: createData.name
        }
      }, corsHeaders)
    }

    // List resources (services and env groups)
    console.log('[render-list-resources] Listing resources for owner:', owner_id)

    // Parallel API calls for services and env groups
    const [servicesRes, groupsRes] = await Promise.all([
      fetch(`${RENDER_API}/services?ownerId=${owner_id}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(`${RENDER_API}/env-groups?ownerId=${owner_id}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ])

    // Handle services response
    let services: RenderService[] = []
    if (servicesRes.ok) {
      const servicesData = await servicesRes.json()
      // Response has nested service object
      services = servicesData.map((item: any) => ({
        id: item.service.id,
        name: item.service.name,
        type: item.service.type
      }))
    } else {
      console.warn('[render-list-resources] Failed to fetch services:', servicesRes.status)
    }

    // Handle env groups response
    let envGroups: RenderEnvGroup[] = []
    if (groupsRes.ok) {
      const groupsData = await groupsRes.json()
      // Response has nested envGroup object
      envGroups = groupsData.map((item: any) => ({
        id: item.envGroup.id,
        name: item.envGroup.name
      }))
    } else {
      console.warn('[render-list-resources] Failed to fetch env groups:', groupsRes.status)
    }

    console.log('[render-list-resources] Found', services.length, 'services,', envGroups.length, 'env groups')

    return jsonResponse({
      services,
      envGroups
    }, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
