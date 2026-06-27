/**
 * Error handling utilities for Edge Functions
 */

import { logError } from './logger.js'

export class AppError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public statusCode: number,
  ) {
    super(userMessage)
    this.name = 'AppError'
  }
}

/**
 * Handle an error: log full details server-side, return safe message to client
 */
export function handleError(
  error: unknown,
  corsHeaders: HeadersInit,
  requestId?: string,
): Response {
  logError(error, requestId ? { requestId } : undefined)

  let message = 'An unexpected error occurred'
  let status = 500

  if (error instanceof AppError) {
    message = error.userMessage
    status = error.statusCode
  }

  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
