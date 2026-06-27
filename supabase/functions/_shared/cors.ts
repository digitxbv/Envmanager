/**
 * CORS headers for Edge Functions
 * Origin allowlist with dynamic matching
 */

const PRODUCTION_ORIGINS = [
  'https://envmanager.com',
  'https://app.envmanager.com',
]

function getAllowedOrigins(): string[] {
  const env = Deno.env.get('ENVIRONMENT')
  if (!env || env === 'development') {
    return [...PRODUCTION_ORIGINS, 'http://localhost:4400']
  }
  return PRODUCTION_ORIGINS
}

/**
 * Get CORS headers with origin validation based on the incoming request
 */
export function getCorsHeaders(request: Request): HeadersInit {
  const requestOrigin = request.headers.get('Origin') ?? ''
  const allowed = getAllowedOrigins()
  const origin = allowed.includes(requestOrigin) ? requestOrigin : allowed[0]

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Client-Info, apikey',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Static CORS headers fallback for server-to-server functions without a request object
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': PRODUCTION_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Client-Info, apikey',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
}
