// Shared GitHub App JWT creation using jose library
// Handles PKCS#1 (RSA PRIVATE KEY) format that GitHub App uses

import { importPKCS8, SignJWT } from 'https://deno.land/x/jose@v5.2.0/index.ts'

/**
 * Creates a JWT for GitHub App authentication.
 * Expects the private key to be base64 encoded PEM (PKCS#1 or PKCS#8).
 */
export async function createGitHubAppJWT(appId: string, privateKeyBase64: string): Promise<string> {
  // Decode base64 to get PEM string
  let pemContents = atob(privateKeyBase64)

  // GitHub App keys are PKCS#1 format (RSA PRIVATE KEY)
  // jose's importPKCS8 requires PKCS#8 format (PRIVATE KEY)
  // Convert header/footer if needed
  if (pemContents.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    pemContents = pemContents
      .replace('-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----')
      .replace('-----END RSA PRIVATE KEY-----', '-----END PRIVATE KEY-----')

    // For PKCS#1 to PKCS#8 conversion, we need to wrap the key
    // Extract the base64 body
    const lines = pemContents.split('\n')
    const bodyLines = lines.filter(line =>
      !line.includes('-----BEGIN') &&
      !line.includes('-----END') &&
      line.trim() !== ''
    )
    const keyBody = bodyLines.join('')
    const keyBytes = Uint8Array.from(atob(keyBody), c => c.charCodeAt(0))

    // PKCS#8 wrapper for RSA private key
    // ASN.1 structure: SEQUENCE { INTEGER 0, SEQUENCE { OID rsaEncryption, NULL }, OCTET STRING { privateKey } }
    const rsaOid = new Uint8Array([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00])

    // Build OCTET STRING containing the private key
    const octetString = wrapAsn1(0x04, keyBytes)

    // Build the algorithm identifier (already wrapped as SEQUENCE)
    // Build version INTEGER 0
    const version = new Uint8Array([0x02, 0x01, 0x00])

    // Combine into final SEQUENCE
    const inner = new Uint8Array(version.length + rsaOid.length + octetString.length)
    inner.set(version, 0)
    inner.set(rsaOid, version.length)
    inner.set(octetString, version.length + rsaOid.length)

    const pkcs8Key = wrapAsn1(0x30, inner)

    // Convert back to PEM
    const pkcs8Base64 = btoa(String.fromCharCode(...pkcs8Key))
    const formattedBase64 = pkcs8Base64.match(/.{1,64}/g)?.join('\n') ?? pkcs8Base64
    pemContents = `-----BEGIN PRIVATE KEY-----\n${formattedBase64}\n-----END PRIVATE KEY-----`
  }

  const privateKey = await importPKCS8(pemContents, 'RS256')

  const now = Math.floor(Date.now() / 1000)

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(appId)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 600)
    .sign(privateKey)

  return jwt
}

// Helper to wrap data in ASN.1 tag
function wrapAsn1(tag: number, data: Uint8Array): Uint8Array {
  const len = data.length
  let header: Uint8Array

  if (len < 128) {
    header = new Uint8Array([tag, len])
  } else if (len < 256) {
    header = new Uint8Array([tag, 0x81, len])
  } else if (len < 65536) {
    header = new Uint8Array([tag, 0x82, (len >> 8) & 0xff, len & 0xff])
  } else {
    throw new Error('Data too long for ASN.1 encoding')
  }

  const result = new Uint8Array(header.length + data.length)
  result.set(header, 0)
  result.set(data, header.length)
  return result
}
