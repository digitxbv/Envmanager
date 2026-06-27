import { describe, it, expect } from 'vitest'
// @ts-ignore Deno edge-function module — resolved by vitest at runtime, not visible to the Nuxt tsconfig
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  makeUnsubscribeUrl,
  renderLifecycleEmail,
} from '../../supabase/functions/_shared/lifecycle-emails'

const SECRET = 'test-secret-value'
const USER = '11111111-1111-1111-1111-111111111111'

describe('unsubscribe token', () => {
  it('round-trips a valid token back to the user id', async () => {
    const token = await signUnsubscribeToken(USER, SECRET)
    expect(await verifyUnsubscribeToken(token, SECRET)).toBe(USER)
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signUnsubscribeToken(USER, SECRET)
    expect(await verifyUnsubscribeToken(token, 'other-secret')).toBeNull()
  })

  it('rejects a tampered user id', async () => {
    const token = await signUnsubscribeToken(USER, SECRET)
    const tampered = token.replace(USER, '22222222-2222-2222-2222-222222222222')
    expect(await verifyUnsubscribeToken(tampered, SECRET)).toBeNull()
  })

  it('rejects malformed tokens', async () => {
    expect(await verifyUnsubscribeToken('garbage', SECRET)).toBeNull()
    expect(await verifyUnsubscribeToken('', SECRET)).toBeNull()
  })
})

describe('makeUnsubscribeUrl', () => {
  it('builds an app url with a verifiable token', async () => {
    const url = await makeUnsubscribeUrl(USER, 'https://envmanager.com', SECRET)
    expect(url.startsWith('https://envmanager.com/email/unsubscribe?token=')).toBe(true)
    const token = new URL(url).searchParams.get('token')!
    expect(await verifyUnsubscribeToken(token, SECRET)).toBe(USER)
  })
})

describe('renderLifecycleEmail', () => {
  const ctx = { appUrl: 'https://envmanager.com', unsubscribeUrl: 'https://envmanager.com/email/unsubscribe?token=abc' }

  it('renders each type with subject, html and text', () => {
    for (const type of ['welcome', 'how_to_pull', 'invite_team', 'trial_ending'] as const) {
      const out = renderLifecycleEmail(type, ctx)
      expect(out.subject.length).toBeGreaterThan(0)
      expect(out.html).toContain(ctx.unsubscribeUrl)
      expect(out.text).toContain(ctx.unsubscribeUrl)
    }
  })

  it('throws on an unknown type', () => {
    expect(() => renderLifecycleEmail('nope' as never, ctx)).toThrow()
  })
})
