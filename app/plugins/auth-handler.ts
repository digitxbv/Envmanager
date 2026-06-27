export default defineNuxtPlugin(() => {
  const client = useSupabaseClient()
  const user = useSupabaseUser()
  const router = useRouter()

  // Listen for auth state changes
  client.auth.onAuthStateChange(async (event, session) => {
    // Handle sign out events
    if (event === 'SIGNED_OUT') {
      // Clear user state
      user.value = null

      // Redirect to login if not already on auth page
      const currentPath = router.currentRoute.value.path
      if (!currentPath.startsWith('/auth/') && !currentPath.startsWith('/')) {
        await router.push('/auth/login')
      }
    }

    // Handle token expired events
    if (event === 'TOKEN_REFRESHED' && !session) {
      // Token refresh failed - session is invalid
      await client.auth.signOut()
      await router.push('/auth/login')
    }
  })

  // Periodically verify session is still valid
  const verifySession = async () => {
    if (!user.value) return

    const { error } = await client.auth.getUser()

    // If we get an error (403, unauthorized, etc.), sign out
    if (error) {
      console.warn('[auth-handler] Session verification failed:', error.message)
      await client.auth.signOut()
      await router.push('/auth/login')
    }
  }

  // Check session validity every 5 minutes
  if (process.client) {
    setInterval(verifySession, 5 * 60 * 1000)
  }

  // Global error handler for Supabase API calls
  return {
    provide: {
      handleSupabaseError: async (error: any) => {
        // Check for authentication errors
        if (error?.code === '401' ||
            error?.code === '403' ||
            error?.code === 'PGRST301' ||
            error?.message?.includes('JWT') ||
            error?.message?.includes('session') ||
            error?.message?.includes('unauthorized')) {

          console.warn('[auth-handler] Authentication error detected:', error)

          // Sign out and redirect to login
          await client.auth.signOut()
          await router.push('/auth/login')

          return true // Indicates error was handled
        }

        return false // Error not handled
      }
    }
  }
})
