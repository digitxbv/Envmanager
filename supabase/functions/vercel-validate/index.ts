// Vercel Token Validation Edge Function
// Validates user's Vercel access token and returns user info + teams
//
// POST /vercel-validate
// Body: { token: string }
// Returns: { valid: boolean, user?: {...}, teams?: [...], error?: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { requireEnv } from '../_shared/require-env.ts'

interface ValidateRequest {
  token: string
}

interface VercelUser {
  id: string
  username: string
  email: string
  name: string | null
}

interface VercelTeam {
  id: string
  name: string
  slug: string
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

    console.log('[vercel-validate] Validating token for user:', user.id)

    // 1. Validate token by fetching user info
    const userResponse = await fetch('https://api.vercel.com/v2/user', {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!userResponse.ok) {
      const status = userResponse.status
      if (status === 401 || status === 403) {
        return jsonResponse({
          valid: false,
          error: 'Invalid or expired token. Please check your Vercel access token.'
        }, corsHeaders)
      }
      return jsonResponse({
        valid: false,
        error: `Vercel API error: ${status}`
      }, corsHeaders)
    }

    const userData = await userResponse.json()
    const vercelUser: VercelUser = {
      id: userData.user.id,
      username: userData.user.username,
      email: userData.user.email,
      name: userData.user.name
    }

    // 2. Fetch teams (for team project access)
    let teams: VercelTeam[] = []
    try {
      const teamsResponse = await fetch('https://api.vercel.com/v2/teams', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json()
        teams = (teamsData.teams || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          slug: t.slug
        }))
      }
    } catch (e) {
      // Teams fetch is optional, don't fail validation
      console.warn('[vercel-validate] Failed to fetch teams:', e)
    }

    console.log('[vercel-validate] Token valid, user:', vercelUser.username, 'teams:', teams.length)

    return jsonResponse({
      valid: true,
      user: vercelUser,
      teams
    }, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
