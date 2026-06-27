// Shared cloud provider authentication helpers for GCP, Azure, and AWS
// Used by cloud integration Edge Functions (Deno runtime)

import { SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v5.2.0/index.ts'

// --- GCP ---

/**
 * Exchanges a GCP service account JSON key for an OAuth2 access token.
 */
export async function getGcpAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson)
  const { client_email, private_key } = sa

  const scope = 'https://www.googleapis.com/auth/cloud-platform'
  const aud = 'https://oauth2.googleapis.com/token'

  const key = await importPKCS8(private_key, 'RS256')

  const jwt = await new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(client_email)
    .setSubject(client_email)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key)

  const res = await fetch(aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(jwt)}`,
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('GCP token exchange error body:', body)
    throw new Error(`GCP token exchange failed (${res.status})`)
  }

  const data = await res.json()
  return data.access_token
}

// --- Azure ---

/**
 * Obtains an Azure AD access token using client credentials flow.
 */
export async function getAzureAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  scope: string,
): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope,
    grant_type: 'client_credentials',
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('Azure token exchange error body:', body)
    throw new Error(`Azure token exchange failed (${res.status})`)
  }

  const data = await res.json()
  return data.access_token
}

// --- AWS Signature V4 ---

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return toHex(hash)
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const keyBytes = key instanceof ArrayBuffer ? new Uint8Array(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
}

/**
 * Signs an HTTP request using AWS Signature Version 4.
 * Returns a headers object containing Authorization, x-amz-date, x-amz-content-sha256, and host.
 */
export async function signAwsRequest(
  accessKeyId: string,
  secretKey: string,
  region: string,
  service: string,
  request: {
    method: string
    url: string
    headers: Record<string, string>
    body?: string
  },
): Promise<Record<string, string>> {
  const url = new URL(request.url)
  const host = url.host
  const path = url.pathname || '/'
  const queryString = url.searchParams.toString()

  const now = new Date()
  const datetime = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const date = datetime.slice(0, 8)

  const payloadHash = await sha256Hex(request.body ?? '')

  // Canonical headers: merge provided headers with required ones, all lowercased
  const allHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(request.headers)) {
    allHeaders[k.toLowerCase()] = v.trim()
  }
  allHeaders['host'] = host
  allHeaders['x-amz-date'] = datetime
  allHeaders['x-amz-content-sha256'] = payloadHash

  const sortedHeaderKeys = Object.keys(allHeaders).sort()
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${allHeaders[k]}`).join('\n') + '\n'
  const signedHeaders = sortedHeaderKeys.join(';')

  const canonicalRequest = [
    request.method.toUpperCase(),
    path,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${date}/${region}/${service}/aws4_request`

  const canonicalRequestHash = await sha256Hex(canonicalRequest)
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    credentialScope,
    canonicalRequestHash,
  ].join('\n')

  // Derive signing key: HMAC chain
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretKey}`), date)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  const kSigning = await hmacSha256(kService, 'aws4_request')

  const signature = toHex(await hmacSha256(kSigning, stringToSign))

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    Authorization: authorization,
    'x-amz-date': datetime,
    'x-amz-content-sha256': payloadHash,
    host,
  }
}
