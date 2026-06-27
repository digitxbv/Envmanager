// Coolify Token Validation Edge Function
// Validates user's Coolify API token against their self-hosted instance
//
// POST /coolify-validate
// Body: { instance_url: string, token: string, ca_cert?: string }
// Returns: { valid: boolean, error?: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { requireEnv } from '../_shared/require-env.ts'
import { logError } from '../_shared/logger.js'

interface ValidateRequest {
  instance_url: string
  token: string
  ca_cert?: string
}

// Normalize Coolify instance URL
function normalizeUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '')
  // Add https:// if no protocol specified
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized
  }
  // Remove /api/v1 suffix if present (we'll add it back)
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
  const { user, error: authError } = await verifyAuth(
    req, supabaseUrl, supabaseAnonKey, supabaseServiceKey
  )

  if (authError || !user) {
    return unauthorizedResponse(corsHeaders, authError || 'Invalid authentication')
  }

  try {
    const body: ValidateRequest = await req.json()
    const { instance_url, token, ca_cert } = body

    if (!instance_url) {
      return errorResponse('Instance URL is required', corsHeaders, 400)
    }

    if (!token) {
      return errorResponse('Token is required', corsHeaders, 400)
    }

    console.log('[coolify-validate] Validating token for user:', user.id)

    const baseUrl = normalizeUrl(instance_url)
    const coolifyFetch = createCoolifyFetch(ca_cert)

    // Call GET /api/v1/applications to validate token
    const response = await coolifyFetch(`${baseUrl}/api/v1/applications`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return jsonResponse({
          valid: false,
          error: 'Invalid or expired API token'
        }, corsHeaders)
      }

      const errorText = await response.text().catch(() => '')
      console.log('[coolify-validate] API error:', response.status, errorText)

      return jsonResponse({
        valid: false,
        error: `API error: ${response.status}`
      }, corsHeaders)
    }

    console.log('[coolify-validate] Token valid')

    return jsonResponse({
      valid: true
    }, corsHeaders)

  } catch (error) {
    // Handle specific error cases
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      // SSL certificate errors
      if (message.includes('certificate') || message.includes('ssl') ||
          message.includes('tls') || message.includes('unknown_issuer') ||
          message.includes('cert')) {
        return jsonResponse({
          valid: false,
          error: 'SSL certificate error. If using self-signed certificate, please provide the CA certificate.'
        }, corsHeaders)
      }

      // Network/connection errors
      if (message.includes('failed to fetch') || message.includes('connection') ||
          message.includes('network') || message.includes('dns') ||
          message.includes('timeout')) {
        return jsonResponse({
          valid: false,
          error: 'Cannot connect to Coolify instance. Check the URL and network access.'
        }, corsHeaders)
      }
    }

    return handleError(error, corsHeaders)
  }
})
