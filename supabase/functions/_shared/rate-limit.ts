export interface RateLimitConfig {
  requestsPerMinute: number
  requestsPerHour: number
}

/**
 * Platform-specific rate limits
 * Conservative values based on documented and observed limits
 */
export const PLATFORM_LIMITS: Record<string, RateLimitConfig> = {
  vercel: { requestsPerMinute: 120, requestsPerHour: 7200 },
  railway: { requestsPerMinute: 10, requestsPerHour: 100 }, // Free tier conservative
  render: { requestsPerMinute: 60, requestsPerHour: 3600 },
  dokploy: { requestsPerMinute: 60, requestsPerHour: 3600 }, // Self-hosted, generous
  coolify: { requestsPerMinute: 60, requestsPerHour: 3600 }, // Self-hosted, generous
  github: { requestsPerMinute: 60, requestsPerHour: 5000 },
}

export interface RateLimitState {
  count: number
  resetAt: number
}

export interface RateLimitResult {
  allowed: boolean
  newState: RateLimitState
  retryAfter?: number
}

/**
 * Check if a request is allowed under rate limits
 * Caller is responsible for persisting state between invocations if needed
 */
export function checkRateLimit(
  platform: string,
  currentState: RateLimitState | null,
  now: number = Date.now()
): RateLimitResult {
  const config = PLATFORM_LIMITS[platform]
  if (!config) {
    // Unknown platform - allow with no state tracking
    return {
      allowed: true,
      newState: { count: 1, resetAt: now + 60000 },
    }
  }

  const windowMs = 60000 // 1 minute window

  // If no state or window expired, start fresh
  if (!currentState || now >= currentState.resetAt) {
    return {
      allowed: true,
      newState: { count: 1, resetAt: now + windowMs },
    }
  }

  // Check if under limit
  if (currentState.count < config.requestsPerMinute) {
    return {
      allowed: true,
      newState: { count: currentState.count + 1, resetAt: currentState.resetAt },
    }
  }

  // Over limit
  const retryAfter = Math.ceil((currentState.resetAt - now) / 1000)
  return {
    allowed: false,
    newState: currentState,
    retryAfter,
  }
}
