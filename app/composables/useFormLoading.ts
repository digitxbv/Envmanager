import { ref, computed, type Ref, type ComputedRef } from 'vue'

export interface UseFormLoadingReturn {
  isLoading: Ref<boolean>
  isDisabled: ComputedRef<boolean>
  error: Ref<string | null>
  success: Ref<boolean>

  withLoading: <T>(fn: () => Promise<T>) => Promise<T>
  setError: (message: string) => void
  clearError: () => void
  setSuccess: () => void
  reset: () => void
}

/**
 * Vue composable for managing form loading states
 * Provides consistent loading, error, and success state management across forms
 */
export function useFormLoading(): UseFormLoadingReturn {
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const success = ref<boolean>(false)

  const isDisabled = computed(() => isLoading.value)

  /**
   * Wraps an async operation with loading state management
   * @param fn - Async function to execute with loading state
   * @returns Promise with the result of the function
   */
  const withLoading = async <T>(fn: () => Promise<T>): Promise<T> => {
    isLoading.value = true
    error.value = null
    success.value = false

    try {
      const result = await fn()
      success.value = true
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      error.value = errorMessage
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Manually set an error message
   * @param message - Error message to display
   */
  const setError = (message: string): void => {
    error.value = message
    isLoading.value = false
    success.value = false
  }

  /**
   * Clear the current error state
   */
  const clearError = (): void => {
    error.value = null
  }

  /**
   * Mark the operation as successful
   */
  const setSuccess = (): void => {
    success.value = true
    error.value = null
    isLoading.value = false
  }

  /**
   * Reset all states to initial values
   */
  const reset = (): void => {
    isLoading.value = false
    error.value = null
    success.value = false
  }

  return {
    isLoading,
    isDisabled,
    error,
    success,
    withLoading,
    setError,
    clearError,
    setSuccess,
    reset
  }
}