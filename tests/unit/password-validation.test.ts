import { describe, it, expect } from 'vitest'
import { validatePassword } from '~/composables/usePasswordValidation'

describe('Password Validation (relaxed policy: min 8 chars)', () => {
  it('is invalid below 8 characters', () => {
    const result = validatePassword('Short1!')
    expect(result.isValid).toBe(false)
    expect(result.meetsMinLength).toBe(false)
    expect(result.errors).toContain('Password must be at least 8 characters')
  })

  it('is valid at 8+ characters even without character classes', () => {
    const result = validatePassword('password') // 8 chars, all lowercase
    expect(result.isValid).toBe(true)
    expect(result.meetsMinLength).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('is valid for a simple 8-char alphanumeric password', () => {
    expect(validatePassword('abcd1234').isValid).toBe(true)
  })

  it('still reports character-class booleans for the strength meter', () => {
    const result = validatePassword('ValidPass123!')
    expect(result.isValid).toBe(true)
    expect(result.hasUppercase).toBe(true)
    expect(result.hasLowercase).toBe(true)
    expect(result.hasNumber).toBe(true)
    expect(result.hasSpecialChar).toBe(true)
    expect(result.strength).toBe('strong')
  })

  it('computes strong strength when all 5 signals are present', () => {
    expect(validatePassword('VeryStrong123!').strength).toBe('strong')
  })

  it('computes weak strength for a short single-class string', () => {
    expect(validatePassword('abc').strength).toBe('weak')
  })

  it('handles empty string', () => {
    const result = validatePassword('')
    expect(result.isValid).toBe(false)
    expect(result.meetsMinLength).toBe(false)
    expect(result.strength).toBe('weak')
  })
})
