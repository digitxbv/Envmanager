// Render Token Validation Edge Function
// Validates user's Render API key and returns owner info (workspaces/teams)
//
// POST /render-validate
// Body: { token: string }
// Returns: { valid: boolean, owners?: [...], error?: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { requireEnv } from '../_shared/require-env.ts'

const RENDER_API = 'https://api.render.com/v1'

interface ValidateRequest {
  token: string
}

interface RenderOwner {
  id: string
  name: string
  type: string  // "user" or "team"
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

    console.log('[render-validate] Validating token for user:', user.id)

    // Query Render REST API for owners (workspaces/teams)
    const response = await fetch(`${RENDER_API}/owners?limit=100`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    // Handle auth errors
    if (response.status === 401 || response.status === 403) {
      console.log('[render-validate] Invalid token (401/403)')
      return jsonResponse({
        valid: false,
        error: 'Invalid or expired API key. Please check your Render API key.'
      }, corsHeaders)
    }

    if (!response.ok) {
      const text = await response.text()
      console.log('[render-validate] API error:', response.status, text)
      return jsonResponse({
        valid: false,
        error: `API error: ${response.status}`
      }, corsHeaders)
    }

    const data = await response.json()

    // Map response to owners array
    // Render API returns array with nested owner objects
    const owners: RenderOwner[] = data.map((item: any) => ({
      id: item.owner.id,
      name: item.owner.name,
      type: item.owner.type
    }))

    console.log('[render-validate] Token valid, owners:', owners.length)

    return jsonResponse({
      valid: true,
      owners
    }, corsHeaders)

  } catch (error) {
    // Handle specific error cases
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
        return jsonResponse({
          valid: false,
          error: 'Invalid or expired API key. Please check your Render API key.'
        }, corsHeaders)
      }
    }

    return handleError(error, corsHeaders)
  }
})
