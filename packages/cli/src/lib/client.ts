import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { getApiKeyFromEnv, getStoredApiUrl, getStoredApiKey } from './credentials.js'
import { ensureAuthenticated, exchangeApiKeyForToken, clearCachedToken } from './auth.js'
import { setUserFromToken } from './telemetry.js'

const DEFAULT_API_URL = 'https://rhopfaburfflrdwpowcd.supabase.co'
const DEFAULT_ANON_KEY = 'sb_publishable_Y2EpPiIN3KPjQMc1GLVXjw__ghRVLC4'
const LOCAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

function getApiUrl(): string {
  return process.env.ENVMANAGER_API_URL || getStoredApiUrl() || DEFAULT_API_URL
}

function getAnonKey(): string {
  const apiUrl = getApiUrl()
  if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    return LOCAL_ANON_KEY
  }
  return process.env.ENVMANAGER_ANON_KEY || DEFAULT_ANON_KEY
}

let clientInstance: SupabaseClient | null = null
let currentAccessToken: string | null = null

export async function createClient(): Promise<SupabaseClient> {
  if (clientInstance) {
    return clientInstance
  }

  // Priority: 1. Environment API key, 2. Stored API key (from login), 3. Session tokens
  const apiKey = getApiKeyFromEnv() || getStoredApiKey()

  if (apiKey) {
    const tokenResponse = await exchangeApiKeyForToken(apiKey)
    currentAccessToken = tokenResponse.access_token
    // Stitch all telemetry from this run to the Supabase user behind the token.
    setUserFromToken(currentAccessToken)

    clientInstance = createSupabaseClient(getApiUrl(), getAnonKey(), {
      global: {
        headers: {
          Authorization: `Bearer ${currentAccessToken}`
        }
      }
    })

    await clientInstance.realtime.setAuth(currentAccessToken)
    return clientInstance
  }

  // Legacy flow: session tokens
  currentAccessToken = await ensureAuthenticated()
  setUserFromToken(currentAccessToken)

  clientInstance = createSupabaseClient(getApiUrl(), getAnonKey(), {
    global: {
      headers: {
        Authorization: `Bearer ${currentAccessToken}`
      }
    }
  })

  await clientInstance.realtime.setAuth(currentAccessToken)

  return clientInstance
}

export function getAccessToken(): string | null {
  return currentAccessToken
}

export async function refreshClientAuth(): Promise<void> {
  if (!clientInstance) return

  const accessToken = await ensureAuthenticated()
  currentAccessToken = accessToken

  // Update the realtime connection's auth token (preserves active channels)
  await clientInstance.realtime.setAuth(accessToken)
}

export function resetClient(): void {
  clientInstance = null
  currentAccessToken = null
  clearCachedToken()
}
