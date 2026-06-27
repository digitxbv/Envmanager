import { createServer, IncomingMessage, ServerResponse } from 'http'
import { randomBytes, createHash } from 'crypto'
import { createInterface } from 'readline'
import open from 'open'
import chalk from 'chalk'
import ora from 'ora'
import { saveCredentials, getCredentials, isTokenExpired, shouldRefreshToken, getStoredApiKey, getStoredApiUrl } from './credentials.js'

const DEFAULT_APP_URL = 'https://envmanager.com'
const DEFAULT_API_URL = 'https://rhopfaburfflrdwpowcd.supabase.co'

function getAppUrl(): string {
  return process.env.ENVMANAGER_APP_URL || DEFAULT_APP_URL
}

function getApiUrl(): string {
  return process.env.ENVMANAGER_API_URL || getStoredApiUrl() || DEFAULT_API_URL
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

function generateState(): string {
  return randomBytes(16).toString('hex')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface AuthCallbackResult {
  apiKey?: string
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
}

async function startCallbackServer(expectedState: string, port: number = 8976): Promise<AuthCallbackResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close()
      reject(new Error('Authentication timed out after 5 minutes'))
    }, 5 * 60 * 1000)

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`)
      
      if (url.pathname === '/callback') {
        const apiKey = url.searchParams.get('api_key')
        const accessToken = url.searchParams.get('access_token')
        const refreshToken = url.searchParams.get('refresh_token')
        const expiresIn = url.searchParams.get('expires_in')
        const state = url.searchParams.get('state')
        const error = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>Authentication Failed</h1>
                <p>${escapeHtml(errorDescription || error || 'Unknown error')}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `)
          clearTimeout(timeout)
          server.close()
          reject(new Error(errorDescription || error))
          return
        }

        // Accept either API key (new flow) or session tokens (legacy/fallback)
        if (!apiKey && (!accessToken || !refreshToken)) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>Invalid Callback</h1>
                <p>Missing authentication credentials.</p>
              </body>
            </html>
          `)
          clearTimeout(timeout)
          server.close()
          reject(new Error('Invalid callback: missing credentials'))
          return
        }

        if (!state || state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>Invalid State</h1>
                <p>State mismatch - possible CSRF attack.</p>
              </body>
            </html>
          `)
          clearTimeout(timeout)
          server.close()
          reject(new Error('State mismatch - authentication failed'))
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>Authentication Successful!</h1>
              <p>You can close this window and return to your terminal.</p>
            </body>
          </html>
        `)

        clearTimeout(timeout)
        server.close()

        // Return API key if present (new flow), otherwise return tokens (legacy)
        if (apiKey) {
          resolve({ apiKey })
        } else {
          resolve({
            accessToken: accessToken!,
            refreshToken: refreshToken!,
            expiresIn: parseInt(expiresIn || '3600', 10)
          })
        }
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    server.listen(port, '127.0.0.1', () => {})
    
    server.on('error', (err: Error & { code?: string }) => {
      clearTimeout(timeout)
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Please close the application using it.`))
      } else {
        reject(err)
      }
    })
  })
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user?: {
    id: string
    email?: string
  }
}

async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
  const apiUrl = getApiUrl()
  const response = await fetch(`${apiUrl}/functions/v1/cli-auth-callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  return response.json() as Promise<TokenResponse>
}

// In-memory cache for exchanged API key tokens (process lifetime only)
let cachedToken: { accessToken: string; refreshToken: string; expiresAt: number } | null = null

export function clearCachedToken(): void {
  cachedToken = null
}

export async function refreshTokens(): Promise<void> {
  const credentials = getCredentials()
  if (!credentials?.refreshToken) {
    throw new Error('No refresh token available')
  }

  const apiUrl = getApiUrl()
  const response = await fetch(`${apiUrl}/functions/v1/cli-auth-refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: credentials.refreshToken,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` })) as { error?: string }
    const errorMessage = errorData.error || `HTTP ${response.status}`
    throw new Error(`Token refresh failed: ${errorMessage}`)
  }

  const tokens = await response.json() as TokenResponse
  
  saveCredentials({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    email: credentials.email,
  })
}

export async function exchangeApiKeyForToken(apiKey: string): Promise<TokenResponse> {
  const apiUrl = getApiUrl()
  const response = await fetch(`${apiUrl}/functions/v1/cli-api-key-auth`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  return response.json() as Promise<TokenResponse>
}

export async function loginWithBrowser(): Promise<{ email?: string }> {
  const state = generateState()
  const port = 8976
  const redirectUri = `http://localhost:${port}/callback`

  const appUrl = getAppUrl()
  const authUrl = new URL(`${appUrl}/auth/cli-login`)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)

  const serverPromise = startCallbackServer(state, port)

  // Always print the URL as fallback
  console.log(chalk.bold('\nOpen this URL to authenticate:\n'))
  console.log(`  ${chalk.cyan(authUrl.toString())}\n`)

  try {
    await open(authUrl.toString())
  } catch {
    console.log(chalk.yellow('Could not open browser automatically.'))
    console.log(chalk.gray('Open the URL above manually, or use `envmanager login --manual` for headless servers.\n'))
  }

  const result = await serverPromise

  // New flow: API key based authentication
  if (result.apiKey) {
    saveCredentials({
      apiKey: result.apiKey,
      apiUrl: getApiUrl(),
    })
    return {}
  }

  // Legacy flow: session tokens (fallback)
  saveCredentials({
    accessToken: result.accessToken!,
    refreshToken: result.refreshToken!,
    expiresAt: Date.now() + (result.expiresIn || 3600) * 1000,
    apiUrl: getApiUrl(),
  })

  return {}
}

function promptForInput(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export async function loginManual(): Promise<{ email?: string }> {
  const appUrl = getAppUrl()
  const authUrl = `${appUrl}/auth/cli-login?mode=manual`

  console.log(chalk.bold('\nOpen this URL in any browser to authenticate:\n'))
  console.log(`  ${chalk.cyan(authUrl)}\n`)
  console.log(chalk.gray('After signing in, copy the code shown on the page and paste it below.\n'))

  const key = await promptForInput('Paste your auth code: ')

  if (!key) {
    throw new Error('No auth code provided.')
  }

  if (!key.startsWith('em_')) {
    throw new Error('Invalid auth code format. The code should start with "em_".')
  }

  const spinner = ora('Validating...').start()

  try {
    await exchangeApiKeyForToken(key)
    spinner.succeed('Valid')
  } catch {
    spinner.fail('Invalid auth code')
    throw new Error('The auth code is invalid or expired. Please try again.')
  }

  saveCredentials({
    apiKey: key,
    apiUrl: getApiUrl(),
  })

  console.log(chalk.green('\nLogged in'))
  return {}
}

export async function ensureAuthenticated(): Promise<string> {
  const credentials = getCredentials()

  if (!credentials) {
    throw new Error('Not authenticated. Run `envmanager login` first.')
  }

  // New flow: API key based authentication
  const storedApiKey = getStoredApiKey()
  if (storedApiKey) {
    // Return cached token if still valid (with 5-minute buffer)
    if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
      return cachedToken.accessToken
    }

    const tokens = await exchangeApiKeyForToken(storedApiKey)
    cachedToken = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    }
    return cachedToken.accessToken
  }

  // Legacy flow: session token refresh
  if (shouldRefreshToken() || isTokenExpired()) {
    try {
      await refreshTokens()
      const newCreds = getCredentials()
      if (newCreds?.accessToken) {
        return newCreds.accessToken
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Session refresh failed: ${message}\nRun \`envmanager login\` to re-authenticate.`)
    }
  }

  if (!credentials.accessToken) {
    throw new Error('Not authenticated. Run `envmanager login` first.')
  }

  return credentials.accessToken
}

export async function tryRefreshToken(): Promise<boolean> {
  try {
    if (shouldRefreshToken() || isTokenExpired()) {
      await refreshTokens()
      return true
    }
    return false
  } catch {
    return false
  }
}
