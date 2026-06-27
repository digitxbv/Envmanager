/**
 * Response helpers for Edge Functions
 */

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(data: unknown, corsHeaders: HeadersInit, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(message: string, corsHeaders: HeadersInit, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorizedResponse(corsHeaders: HeadersInit, message = 'Unauthorized'): Response {
  return errorResponse(message, corsHeaders, 401)
}

/**
 * Create a 404 Not Found response
 */
export function notFoundResponse(corsHeaders: HeadersInit, message = 'Not found'): Response {
  return errorResponse(message, corsHeaders, 404)
}
