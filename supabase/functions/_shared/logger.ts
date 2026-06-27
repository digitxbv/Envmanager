/**
 * Safe logger with sensitive data sanitization
 */

const SENSITIVE_PATTERNS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'credential',
  'apikey',
  'api_key',
  'access_token',
]

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_PATTERNS.some((pattern) => lower.includes(pattern))
}

export function sanitizeObject(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[max depth]'
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1))
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = sanitizeObject(value, depth + 1)
    }
  }
  return sanitized
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const errObj = error as Record<string, unknown>
    const candidates = [
      errObj.message,
      errObj.error,
      errObj.details,
      errObj.hint
    ].filter((value): value is string => typeof value === 'string' && value.length > 0)

    if (candidates.length > 0) {
      return candidates.join(' | ')
    }
  }

  return String(error)
}

export function logError(error: unknown, context?: Record<string, unknown>): void {
  const entry: Record<string, unknown> = {
    level: 'error',
    timestamp: new Date().toISOString(),
    message: formatUnknownError(error),
  }

  if (error instanceof Error && error.stack) {
    entry.stack = error.stack
  }

  if (error && typeof error === 'object' && !(error instanceof Error)) {
    entry.error = sanitizeObject(error)
  }

  if (context) {
    entry.context = sanitizeObject(context)
  }
  console.error(JSON.stringify(entry))
}

export function logInfo(message: string, context?: Record<string, unknown>): void {
  const entry: Record<string, unknown> = {
    level: 'info',
    timestamp: new Date().toISOString(),
    message,
  }
  if (context) {
    entry.context = sanitizeObject(context)
  }
  console.log(JSON.stringify(entry))
}
