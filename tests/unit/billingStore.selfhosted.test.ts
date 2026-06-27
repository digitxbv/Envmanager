import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// useRuntimeConfig is a Nuxt global auto-import (not resolved by vitest).
// Stub it on globalThis so the store getter can call it without Nuxt.
let selfHostedFlag = false
vi.stubGlobal('useRuntimeConfig', () => ({ public: { selfHosted: selfHostedFlag } }))

import { useBillingStore } from '../../app/stores/billing'

const pastTrial = {
  status: 'trialing',
  trial_end_date: new Date(Date.now() - 86_400_000).toISOString(), // yesterday → expired
}
const pausedSub = { status: 'paused', trial_end_date: null }

describe('billing store isLocked', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    selfHostedFlag = false
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('locks a paused workspace in SaaS mode', () => {
    const store = useBillingStore()
    store.subscription = pausedSub
    expect(store.isLocked).toBe(true)
  })

  it('locks an expired trial in SaaS mode', () => {
    const store = useBillingStore()
    store.subscription = pastTrial
    expect(store.isLocked).toBe(true)
  })

  it('never locks when self-hosted, even if paused', () => {
    selfHostedFlag = true
    const store = useBillingStore()
    store.subscription = pausedSub
    expect(store.isLocked).toBe(false)
  })

  it('never locks when self-hosted, even with an expired trial', () => {
    selfHostedFlag = true
    const store = useBillingStore()
    store.subscription = pastTrial
    expect(store.isLocked).toBe(false)
  })
})
