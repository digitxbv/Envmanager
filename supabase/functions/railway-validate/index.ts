// Railway Token Validation Edge Function
// Validates user's Railway API token and returns user info + workspaces
//
// POST /railway-validate
// Body: { token: string }
// Returns: { valid: boolean, user?: {...}, workspaces?: [...], error?: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { requireEnv } from '../_shared/require-env.ts'

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'

interface ValidateRequest {
  token: string
}

interface RailwayUser {
  id: string
  email: string
  name: string | null
  isVerified: boolean
}

interface RailwayWorkspace {
  id: string
  name: string
}

// GraphQL query to get user info AND workspaces
// Note: workspaces is a direct array, NOT edges/node format
const ME_QUERY = `
  query {
    me {
      id
      email
      name
      isVerified
      workspaces {
        id
        name
      }
    }
  }
`

async function railwayQuery<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
  // IMPORTANT: Add ?source=envmanager to bypass Cloudflare 10 RPS hidden limit
  const response = await fetch(`${RAILWAY_API}?source=envmanager`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Railway API error: ${response.status} - ${text}`)
  }

  return response.json()
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
  const { user, error: authError } = await verifyAuth(
    req, supabaseUrl, supabaseAnonKey, supabaseServiceKey
  )

  if (authError || !user) {
    return unauthorizedResponse(corsHeaders, authError || 'Invalid authentication')
  }

  try {
    const body: ValidateRequest = await req.json()
    const { token } = body

    if (!token) {
      return errorResponse('Token is required', corsHeaders, 400)
    }

    console.log('[railway-validate] Validating token for user:', user.id)

    // Query Railway GraphQL API for user info + workspaces
    const meResult = await railwayQuery<{
      me: {
        id: string
        email: string
        name: string | null
        isVerified: boolean
        workspaces: Array<{ id: string; name: string }>
      }
    }>(token, ME_QUERY)

    // Check for GraphQL errors
    if (meResult.errors && meResult.errors.length > 0) {
      const errorMessage = meResult.errors[0].message
      console.log('[railway-validate] GraphQL error:', errorMessage)

      // Check for auth-related errors (including workspace-scoped token)
      if (errorMessage.toLowerCase().includes('not authorized')) {
        return jsonResponse({
          valid: false,
          error: 'Token is workspace-scoped. Please create an Account Token without selecting a workspace for full access.'
        }, corsHeaders)
      }

      if (errorMessage.toLowerCase().includes('unauthorized') ||
          errorMessage.toLowerCase().includes('invalid') ||
          errorMessage.toLowerCase().includes('expired')) {
        return jsonResponse({
          valid: false,
          error: 'Invalid or expired token. Please check your Railway API token.'
        }, corsHeaders)
      }

      return jsonResponse({
        valid: false,
        error: errorMessage
      }, corsHeaders)
    }

    if (!meResult.data?.me) {
      return jsonResponse({
        valid: false,
        error: 'Invalid or expired token. Please check your Railway API token.'
      }, corsHeaders)
    }

    const me = meResult.data.me
    const railwayUser: RailwayUser = {
      id: me.id,
      email: me.email,
      name: me.name,
      isVerified: me.isVerified
    }

    // Extract workspaces from ME response
    const workspaces: RailwayWorkspace[] = (me.workspaces || []).map(ws => ({
      id: ws.id,
      name: ws.name
    }))

    console.log('[railway-validate] Token valid, user:', railwayUser.email, 'workspaces:', workspaces.length)

    return jsonResponse({
      valid: true,
      user: railwayUser,
      workspaces
    }, corsHeaders)

  } catch (error) {
    // Handle specific error cases
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
        return jsonResponse({
          valid: false,
          error: 'Invalid or expired token. Please check your Railway API token.'
        }, corsHeaders)
      }
    }

    return handleError(error, corsHeaders)
  }
})
