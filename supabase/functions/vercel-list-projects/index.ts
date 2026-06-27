// Vercel List Projects Edge Function
// Lists user's Vercel projects (personal and team)
//
// POST /vercel-list-projects
// Body: { connection_id: string, team_id?: string }
// Returns: { projects: [...] }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logError } from '../_shared/logger.js'
import { requireEnv } from '../_shared/require-env.ts'

interface ListRequest {
  connection_id: string
  team_id?: string  // If provided, list team projects
}

interface VercelProject {
  id: string
  name: string
  framework: string | null
  updatedAt: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const { user, userClient, serviceClient, error: authError } = await verifyAuth(
    req, supabaseUrl, supabaseAnonKey, supabaseServiceKey
  )

  if (authError || !user) {
    return unauthorizedResponse(corsHeaders, authError || 'Invalid authentication')
  }

  try {
    const body: ListRequest = await req.json()
    const { connection_id, team_id } = body

    if (!connection_id) {
      return errorResponse('connection_id is required', corsHeaders, 400)
    }

    // Get connection (RLS ensures user has access)
    const { data: connection, error: connError } = await userClient
      .from('platform_integrations')
      .select('*')
      .eq('id', connection_id)
      .eq('platform', 'vercel')
      .is('disconnected_at', null)
      .single()

    if (connError || !connection) {
      return notFoundResponse(corsHeaders, 'Connection not found')
    }

    // Get token from Vault using RPC (created in Plan 01)
    const { data: vaultData, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: connection.api_token_vault_id })

    if (vaultError || !vaultData) {
      logError(vaultError, { functionName: 'vercel-list-projects', context: 'get_vault_secret' })
      return errorResponse('Failed to retrieve credentials', corsHeaders, 500)
    }

    const token = vaultData

    // Fetch projects from Vercel
    const queryParams = team_id ? `?teamId=${team_id}&limit=100` : '?limit=100'
    const response = await fetch(`https://api.vercel.com/v9/projects${queryParams}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.log('[vercel-list-projects] Vercel API error:', response.status, errorText)
      return errorResponse(`Failed to fetch projects: ${response.status}`, corsHeaders, response.status)
    }

    const data = await response.json()
    const projects: VercelProject[] = (data.projects || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      framework: p.framework,
      updatedAt: p.updatedAt
    }))

    console.log('[vercel-list-projects] Found', projects.length, 'projects')

    return jsonResponse({ projects }, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
