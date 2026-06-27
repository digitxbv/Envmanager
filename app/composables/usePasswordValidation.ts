import { z } from 'zod'

export interface PasswordValidation {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'fair' | 'good' | 'strong'
  meetsMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
}

// Minimum length only (8). Character classes are informational (strength meter), not hard requirements.
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')

/**
 * Validates password against security requirements
 * @param password - The password string to validate
 * @returns PasswordValidation object with detailed validation results
 */
export function validatePassword(password: string): PasswordValidation {
  // Check individual requirements
  const meetsMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password)

  // Collect error messages
  const errors: string[] = []
  const result = passwordSchema.safeParse(password)

  if (!result.success) {
    result.error.errors.forEach((err) => {
      errors.push(err.message)
    })
  }

  // Calculate password strength based on requirements met
  const requirementsMet = [
    meetsMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar
  ].filter(Boolean).length

  let strength: PasswordValidation['strength']
  if (requirementsMet === 5) {
    strength = 'strong'
  } else if (requirementsMet === 4) {
    strength = 'good'
  } else if (requirementsMet >= 2) {
    strength = 'fair'
  } else {
    strength = 'weak'
  }

  return {
    isValid: result.success,
    errors,
    strength,
    meetsMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar
  }
}

/**
 * Vue composable for password validation
 * Provides reactive password validation with real-time feedback
 */
export function usePasswordValidation() {
  const password = ref('')
  const validation = computed(() => validatePassword(password.value))

  return {
    password,
    validation,
    validatePassword
  }
}