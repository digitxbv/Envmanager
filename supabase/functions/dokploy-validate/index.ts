// Dokploy Token Validation Edge Function
// Validates user's Dokploy API token against their self-hosted instance
//
// POST /dokploy-validate
// Body: { instance_url: string, token: string, ca_cert?: string }
// Returns: { valid: boolean, user?: {...}, error?: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { requireEnv } from '../_shared/require-env.ts'

interface ValidateRequest {
  instance_url: string
  token: string
  ca_cert?: string
}

interface DokployUser {
  userId: string
  email: string
  name: string
  role: string
}

// Normalize Dokploy instance URL
function normalizeUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '')
  // Add https:// if no protocol specified
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized
  }
  // Remove /api suffix if present (we'll add it back)
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

    console.log('[dokploy-validate] Validating token for user:', user.id)

    const baseUrl = normalizeUrl(instance_url)
    const dokployFetch = createDokployFetch(ca_cert)

    // Call GET /api/user.get to validate token
    const response = await dokployFetch(`${baseUrl}/api/user.get`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': token
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
      console.log('[dokploy-validate] API error:', response.status, errorText)

      return jsonResponse({
        valid: false,
        error: `API error: ${response.status}`
      }, corsHeaders)
    }

    const userData = await response.json()

    // Map response fields per official Dokploy API docs
    const dokployUser: DokployUser = {
      userId: userData.id,
      email: userData.email,
      name: [userData.firstName, userData.lastName].filter(Boolean).join(' ').trim() || userData.email,
      role: 'user'  // API doesn't return role
    }

    console.log('[dokploy-validate] Token valid, user:', dokployUser.email)

    return jsonResponse({
      valid: true,
      user: dokployUser
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
          error: 'Cannot connect to Dokploy instance. Check the URL and network access.'
        }, corsHeaders)
      }
    }

    return handleError(error, corsHeaders)
  }
})
