/**
 * Composable for handling Supabase errors globally
 * Automatically signs out and redirects on authentication errors
 */
export const useSupabaseErrorHandler = () => {
  const client = useSupabaseClient()
  const router = useRouter()
  const { $toast } = useNuxtApp()

  /**
   * Check if an error is an authentication error
   */
  const isAuthError = (error: any): boolean => {
    if (!error) return false

    // Check error code
    if (error.code === '401' || error.code === '403' || error.code === 'PGRST301') {
      return true
    }

    // Check error message for auth-related keywords
    const message = error.message?.toLowerCase() || ''
    return (
      message.includes('jwt') ||
      message.includes('session') ||
      message.includes('unauthorized') ||
      message.includes('token') ||
      message.includes('authentication')
    )
  }

  /**
   * Handle authentication errors by signing out and redirecting
   */
  const handleAuthError = async (error: any) => {
    console.warn('[useSupabaseErrorHandler] Authentication error detected:', error)

    // Sign out
    await client.auth.signOut()

    // Show toast message
    $toast.error('Your session has expired. Please sign in again.')

    // Redirect to login
    await router.push('/auth/login')
  }

  /**
   * Wrap a Supabase operation with automatic error handling
   * Usage: await withErrorHandling(() => client.from('table').select())
   */
  const withErrorHandling = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation()
    } catch (error: any) {
      // Check if it's an auth error
      if (isAuthError(error)) {
        await handleAuthError(error)
        throw error
      }

      // Re-throw non-auth errors
      throw error
    }
  }

  /**
   * Handle a Supabase error response
   * Returns true if error was handled (auth error), false otherwise
   */
  const handleError = async (error: any): Promise<boolean> => {
    if (isAuthError(error)) {
      await handleAuthError(error)
      return true
    }
    return false
  }

  return {
    isAuthError,
    handleAuthError,
    withErrorHandling,
    handleError
  }
}
