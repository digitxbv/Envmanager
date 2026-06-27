import { describe, it, expect, vi } from 'vitest'
import { useFormLoading } from '~/composables/useFormLoading'

describe('Form Loading Composable', () => {
  it('should initialize with default values', () => {
    const { isLoading, isDisabled, error, success } = useFormLoading()

    expect(isLoading.value).toBe(false)
    expect(isDisabled.value).toBe(false)
    expect(error.value).toBe(null)
    expect(success.value).toBe(false)
  })

  it('should set isLoading to true during async execution', async () => {
    const { isLoading, withLoading } = useFormLoading()

    const asyncFn = vi.fn().mockImplementation(() => {
      expect(isLoading.value).toBe(true)
      return Promise.resolve('result')
    })

    await withLoading(asyncFn)

    expect(asyncFn).toHaveBeenCalled()
  })

  it('should set isLoading to false after successful completion', async () => {
    const { isLoading, withLoading } = useFormLoading()

    await withLoading(() => Promise.resolve('success'))

    expect(isLoading.value).toBe(false)
  })

  it('should set success to true after successful completion', async () => {
    const { success, withLoading } = useFormLoading()

    await withLoading(() => Promise.resolve('success'))

    expect(success.value).toBe(true)
  })

  it('should catch errors and set error state', async () => {
    const { error, withLoading } = useFormLoading()
    const errorMessage = 'Test error'

    try {
      await withLoading(() => Promise.reject(new Error(errorMessage)))
    } catch (e) {
      // Expected to throw
    }

    expect(error.value).toBe(errorMessage)
  })

  it('should set isLoading to false after error', async () => {
    const { isLoading, withLoading } = useFormLoading()

    try {
      await withLoading(() => Promise.reject(new Error('Test error')))
    } catch (e) {
      // Expected to throw
    }

    expect(isLoading.value).toBe(false)
  })

  it('should have isDisabled computed value match isLoading', async () => {
    const { isLoading, isDisabled, withLoading } = useFormLoading()

    expect(isDisabled.value).toBe(false)

    const promise = withLoading(() => new Promise(resolve => setTimeout(resolve, 100)))

    // During execution
    expect(isLoading.value).toBe(true)
    expect(isDisabled.value).toBe(true)

    await promise

    // After completion
    expect(isLoading.value).toBe(false)
    expect(isDisabled.value).toBe(false)
  })

  it('should manually set error with setError', () => {
    const { error, isLoading, success, setError } = useFormLoading()

    setError('Manual error')

    expect(error.value).toBe('Manual error')
    expect(isLoading.value).toBe(false)
    expect(success.value).toBe(false)
  })

  it('should clear error with clearError', () => {
    const { error, setError, clearError } = useFormLoading()

    setError('Test error')
    expect(error.value).toBe('Test error')

    clearError()
    expect(error.value).toBe(null)
  })

  it('should set success state with setSuccess', () => {
    const { success, error, isLoading, setSuccess } = useFormLoading()

    setSuccess()

    expect(success.value).toBe(true)
    expect(error.value).toBe(null)
    expect(isLoading.value).toBe(false)
  })

  it('should reset all state with reset', async () => {
    const { isLoading, error, success, setError, reset } = useFormLoading()

    // Set some state
    setError('Test error')

    // Verify state is set
    expect(error.value).toBe('Test error')

    // Reset
    reset()

    // Verify all cleared
    expect(isLoading.value).toBe(false)
    expect(error.value).toBe(null)
    expect(success.value).toBe(false)
  })

  it('should clear error and success when starting withLoading', async () => {
    const { error, success, setError, withLoading } = useFormLoading()

    // Set error and success states
    setError('Previous error')
    success.value = true

    // Start new loading operation
    await withLoading(() => Promise.resolve('success'))

    // Previous states should be cleared
    expect(error.value).toBe(null)
    expect(success.value).toBe(true) // Should be true from successful completion
  })

  it('should handle non-Error thrown objects', async () => {
    const { error, withLoading } = useFormLoading()

    try {
      await withLoading(() => Promise.reject('string error'))
    } catch (e) {
      // Expected to throw
    }

    expect(error.value).toBe('An unexpected error occurred')
  })

  it('should rethrow the error after catching it', async () => {
    const { withLoading } = useFormLoading()
    const testError = new Error('Test error')

    await expect(
      withLoading(() => Promise.reject(testError))
    ).rejects.toThrow('Test error')
  })

  it('should return the result of successful async operation', async () => {
    const { withLoading } = useFormLoading()
    const expectedResult = { data: 'test data' }

    const result = await withLoading(() => Promise.resolve(expectedResult))

    expect(result).toEqual(expectedResult)
  })
})