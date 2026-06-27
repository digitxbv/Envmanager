import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const CONFIG_DIR = join(homedir(), '.config', 'envmanager')
const CREDENTIALS_FILE = join(CONFIG_DIR, 'auth.json')

interface Credentials {
  // New flow: API key based auth (preferred)
  apiKey?: string
  // Legacy flow: session tokens
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  // Common
  apiUrl?: string
  email?: string
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }
}

export function getCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_FILE)) {
    return null
  }

  try {
    const content = readFileSync(CREDENTIALS_FILE, 'utf-8')
    return JSON.parse(content) as Credentials
  } catch {
    return null
  }
}

export function saveCredentials(credentials: Credentials): void {
  ensureConfigDir()
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), { mode: 0o600 })
  chmodSync(CREDENTIALS_FILE, 0o600)
}

export function clearCredentials(): void {
  if (existsSync(CREDENTIALS_FILE)) {
    unlinkSync(CREDENTIALS_FILE)
  }
}

export function isTokenExpired(): boolean {
  const creds = getCredentials()
  if (!creds) return true
  // API key auth doesn't expire in the same way - let the server validate
  if (creds.apiKey) return false
  if (!creds.expiresAt) return true
  return Date.now() >= creds.expiresAt
}

const PROACTIVE_REFRESH_BUFFER_MS = 5 * 60 * 1000

export function shouldRefreshToken(): boolean {
  const creds = getCredentials()
  if (!creds) return false
  // API key auth doesn't need proactive refresh
  if (creds.apiKey) return false
  if (!creds.expiresAt) return false
  return Date.now() >= (creds.expiresAt - PROACTIVE_REFRESH_BUFFER_MS)
}

export function getApiKeyFromEnv(): string | null {
  return process.env.ENVMANAGER_API_KEY || null
}

export function getStoredApiKey(): string | null {
  const creds = getCredentials()
  return creds?.apiKey || null
}

export function getStoredApiUrl(): string | null {
  const creds = getCredentials()
  return creds?.apiUrl || null
}
