// =====================================================
// CLI API Key Auth Edge Function
// =====================================================
// Exchanges an API key for a short-lived JWT.
// Allows CI/CD pipelines to authenticate without OAuth.
//
// Flow:
// 1. CI/CD sends API key in Authorization header or X-API-Key header
// 2. This function validates the API key via validate_api_key RPC
// 3. Creates a custom JWT for the user (1 hour expiry)
// 4. Returns JWT that CLI can use with Supabase client
//
// Deploy with: supabase functions deploy cli-api-key-auth --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'

// =====================================================
// JWT Helper
// =====================================================

async function createCustomJWT(
  userId: string,
  userEmail: string,
  jwtSecret: string,
  expiresIn: number = 3600
): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub: userId,
    email: userEmail,
    role: 'authenticated',
    aud: 'authenticated',
    iat: now,
    exp: now + expiresIn,
    // Mark as API key auth for audit purposes
    api_key_auth: true,
  }

  // Encode header and payload
  const encoder = new TextEncoder()
  const headerB64 = btoa(JSON.stringify(header))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  // Create signature
  const data = encoder.encode(`${headerB64}.${payloadB64}`)
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(jwtSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, data)
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return `${headerB64}.${payloadB64}.${signatureB64}`
}

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
    // Accept both GET and POST
    if (req.method !== 'GET' && req.method !== 'POST') {
      return errorResponse('Method not allowed', corsHeaders, 405)
    }

    // Extract API key from headers
    const authHeader = req.headers.get('Authorization')
    const apiKeyHeader = req.headers.get('X-API-Key')

    let apiKey: string | null = null

    if (authHeader?.startsWith('Bearer em_')) {
      apiKey = authHeader.replace('Bearer ', '')
    } else if (apiKeyHeader?.startsWith('em_')) {
      apiKey = apiKeyHeader
    }

    if (!apiKey) {
      return unauthorizedResponse(corsHeaders, 'Missing or invalid API key. Use Authorization: Bearer em_xxx or X-API-Key: em_xxx')
    }

    // Get Supabase configuration
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const jwtSecret = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_JWT_SECRET')

    // WORKAROUND: Supabase local dev has a mismatch - edge runtime gets ES256 keys
    // but PostgREST uses HS256. Use HS256 service role key for local dev.
    // The key below is the well-known Supabase local dev service role key (published in Supabase docs).
    const isLocalDev = supabaseUrl?.includes('kong:8000') || (supabaseUrl?.includes('localhost') && !supabaseUrl?.includes('supabase.co'))
    const LOCAL_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    const supabaseServiceKey = isLocalDev
      ? LOCAL_SERVICE_ROLE_KEY
      : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !jwtSecret) {
      console.error('[cli-api-key-auth] Missing Supabase configuration')
      return errorResponse('Server configuration error', corsHeaders, 500)
    }

    // Create service client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Validate API key and get user_id
    const { data: userId, error: validateError } = await serviceClient.rpc(
      'validate_api_key',
      { p_api_key: apiKey }
    )

    if (validateError) {
      console.error('[cli-api-key-auth] API key validation error:', validateError.message)
      return errorResponse('Failed to validate API key', corsHeaders, 500)
    }

    if (!userId) {
      console.log('[cli-api-key-auth] Invalid or expired API key')
      return unauthorizedResponse(corsHeaders, 'Invalid or expired API key')
    }

    // Get user details
    const { data: { user }, error: userError } = await serviceClient.auth.admin.getUserById(userId)

    if (userError || !user) {
      console.error('[cli-api-key-auth] Failed to get user:', userError?.message)
      return errorResponse('Failed to retrieve user information', corsHeaders, 500)
    }

    // Generate short-lived JWT (1 hour)
    const expiresIn = 3600
    const accessToken = await createCustomJWT(
      user.id,
      user.email || '',
      jwtSecret,
      expiresIn
    )

    console.log('[cli-api-key-auth] JWT generated for user:', user.id)

    // Return JWT
    return jsonResponse({
      access_token: accessToken,
      expires_in: expiresIn,
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
      },
    }, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
