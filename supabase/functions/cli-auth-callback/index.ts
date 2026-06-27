// =====================================================
// CLI OAuth Callback Edge Function
// =====================================================
// Handles the OAuth PKCE callback from the browser.
// Exchanges the authorization code for tokens.
//
// Flow:
// 1. CLI opens browser to Supabase Auth with PKCE challenge
// 2. User logs in -> redirected to web app callback page
// 3. Web app sends code + code_verifier to this function
// 4. This function exchanges code for session tokens
// 5. Returns tokens to CLI
//
// Deploy with: supabase functions deploy cli-auth-callback --no-verify-jwt

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

    const { code, code_verifier, redirect_url } = body

    // Validate required parameters
    if (!code) {
      return errorResponse('Missing authorization code', corsHeaders, 400)
    }

    if (!code_verifier) {
      return errorResponse('Missing code verifier (PKCE)', corsHeaders, 400)
    }

    // Get Supabase URL and anon key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[cli-auth-callback] Missing Supabase configuration')
      return errorResponse('Server configuration error', corsHeaders, 500)
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Exchange authorization code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[cli-auth-callback] Code exchange failed:', error.message)
      return errorResponse('Authentication failed', corsHeaders, 401)
    }

    if (!data.session) {
      console.error('[cli-auth-callback] No session returned')
      return errorResponse('Failed to create session', corsHeaders, 500)
    }

    console.log('[cli-auth-callback] Session created for user:', data.user?.id)

    // Return tokens to CLI
    return jsonResponse({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: 'Bearer',
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    }, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
