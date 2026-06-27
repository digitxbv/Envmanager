// =====================================================
// CLI Auth Refresh Edge Function
// =====================================================
// Refreshes an expired access token using a refresh token.
//
// Flow:
// 1. CLI sends refresh_token
// 2. This function exchanges it for a new access_token
// 3. Returns new tokens to CLI
//
// Deploy with: supabase functions deploy cli-auth-refresh --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.js'
import { jsonResponse, errorResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'

// =====================================================
// Main Handler
// =====================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', corsHeaders, 405)
    }

    // Parse request body
    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse('Invalid request body', corsHeaders, 400)
    }

    const { refresh_token } = body

    // Validate required parameters
    if (!refresh_token) {
      return errorResponse('Missing refresh token', corsHeaders, 400)
    }

    // Get Supabase URL and anon key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[cli-auth-refresh] Missing Supabase configuration')
      return errorResponse('Server configuration error', corsHeaders, 500)
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Refresh the session
    const { data, error } = await supabase.auth.refreshSession({ refresh_token })

    if (error) {
      console.error('[cli-auth-refresh] Token refresh failed:', error.message)
      return errorResponse('Token refresh failed', corsHeaders, 401)
    }

    if (!data.session) {
      console.error('[cli-auth-refresh] No session returned')
      return errorResponse('Failed to refresh session', corsHeaders, 500)
    }

    console.log('[cli-auth-refresh] Session refreshed for user:', data.user?.id)

    // Return new tokens
    return jsonResponse({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: 'Bearer',
    }, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
