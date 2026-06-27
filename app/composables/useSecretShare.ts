// Zero-knowledge helpers for the one-time secret share tool.
// All encryption/decryption happens in the browser via the Web Crypto API.
// The AES-256-GCM key is never sent to the server — it travels only in the URL #fragment.

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function useSecretShare() {
  const isSupported = () =>
    typeof window !== 'undefined' && !!window.crypto?.subtle

  async function encrypt(plaintext: string) {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = new TextEncoder().encode(plaintext)
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource)
    const rawKey = await crypto.subtle.exportKey('raw', key)
    return {
      ciphertext: bytesToB64Url(new Uint8Array(ct)),
      iv: bytesToB64Url(iv),
      keyB64: bytesToB64Url(new Uint8Array(rawKey)),
    }
  }

  async function decrypt(ciphertext: string, iv: string, keyB64: string) {
    const key = await crypto.subtle.importKey('raw', b64UrlToBytes(keyB64) as BufferSource, { name: 'AES-GCM' }, false, ['decrypt'])
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64UrlToBytes(iv) as BufferSource },
      key,
      b64UrlToBytes(ciphertext) as BufferSource,
    )
    return new TextDecoder().decode(pt)
  }

  // Validate a base64url key is decodable and the right size for AES-256 (32 bytes),
  // so we can refuse a truncated/corrupt link BEFORE irreversibly burning the secret.
  function isValidKeyB64(keyB64: string): boolean {
    try {
      return b64UrlToBytes(keyB64).length === 32
    } catch {
      return false
    }
  }

  return { encrypt, decrypt, isSupported, isValidKeyB64 }
}
