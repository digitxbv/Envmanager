import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { decodeJwtSub, environmentKind, isTelemetryEnabled, classifyError } from '../../src/lib/telemetry'

const CLOUD_API = 'https://rhopfaburfflrdwpowcd.supabase.co'

function makeJwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`
}

describe('telemetry core', () => {
  const savedEnv = { ...process.env }

  beforeEach(() => {
    // Isolate the on-disk telemetry state in a throwaway HOME for every test.
    const home = mkdtempSync(join(tmpdir(), 'em-telemetry-'))
    process.env.HOME = home
    process.env.USERPROFILE = home
    delete process.env.DO_NOT_TRACK
    delete process.env.ENVMANAGER_TELEMETRY
    delete process.env.ENVMANAGER_API_URL
  })

  afterEach(() => {
    process.env = { ...savedEnv }
  })

  describe('decodeJwtSub (distinct id = Supabase user id)', () => {
    it('extracts the sub claim so CLI events stitch to the web person', () => {
      expect(decodeJwtSub(makeJwt({ sub: 'user-123', email: 'a@b.c' }))).toBe('user-123')
    })

    it('returns null for missing or malformed tokens', () => {
      expect(decodeJwtSub(undefined)).toBeNull()
      expect(decodeJwtSub('not-a-jwt')).toBeNull()
      expect(decodeJwtSub(makeJwt({ email: 'a@b.c' }))).toBeNull()
    })
  })

  describe('environmentKind (never leaks the raw name)', () => {
    it('buckets known names and falls back to other/unknown', () => {
      expect(environmentKind('production')).toBe('production')
      expect(environmentKind('prod-eu')).toBe('production')
      expect(environmentKind('staging')).toBe('staging')
      expect(environmentKind('development')).toBe('development')
      expect(environmentKind('client-acme')).toBe('other')
      expect(environmentKind(undefined)).toBe('unknown')
    })
  })

  describe('classifyError (runtime error -> error_code)', () => {
    it('distinguishes auth failures from generic ones', () => {
      expect(classifyError(new Error('Not authenticated. Run `envmanager login` first.'))).toBe('not_authenticated')
      expect(classifyError(new Error('Session refresh failed: bad token'))).toBe('auth_expired')
      expect(classifyError(new Error('HTTP 503'))).toBe('server_error')
      expect(classifyError(new Error('fetch failed'))).toBe('network_error')
      expect(classifyError(new Error('something odd happened'))).toBe('unknown')
    })
  })

  describe('isTelemetryEnabled gating', () => {
    it('is enabled by default against the cloud API', () => {
      process.env.ENVMANAGER_API_URL = CLOUD_API
      expect(isTelemetryEnabled()).toBe(true)
    })

    it('honors DO_NOT_TRACK', () => {
      process.env.ENVMANAGER_API_URL = CLOUD_API
      process.env.DO_NOT_TRACK = '1'
      expect(isTelemetryEnabled()).toBe(false)
    })

    it('honors ENVMANAGER_TELEMETRY=0', () => {
      process.env.ENVMANAGER_API_URL = CLOUD_API
      process.env.ENVMANAGER_TELEMETRY = '0'
      expect(isTelemetryEnabled()).toBe(false)
    })

    it('auto-disables for self-hosted / local endpoints', () => {
      process.env.ENVMANAGER_API_URL = 'http://127.0.0.1:54431'
      expect(isTelemetryEnabled()).toBe(false)
    })
  })
})
