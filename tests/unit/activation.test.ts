import { describe, it, expect } from 'vitest'
import { isFirstActivation } from '../../app/utils/activation'

describe('isFirstActivation', () => {
  it('fires when the just-added variables are the only ones in the project', () => {
    expect(isFirstActivation(1, 1)).toBe(true)
    expect(isFirstActivation(3, 3)).toBe(true)
  })

  it('does not fire when the project already had variables', () => {
    expect(isFirstActivation(5, 1)).toBe(false)
    expect(isFirstActivation(8, 3)).toBe(false)
  })

  it('does not fire on a no-op (nothing added)', () => {
    expect(isFirstActivation(0, 0)).toBe(false)
  })
})
