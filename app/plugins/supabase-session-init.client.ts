// On a hard client load (refresh or a directly-typed URL) in SPA mode, the
// @nuxtjs/supabase module populates the session ref ASYNCHRONOUSLY via
// onAuthStateChange's INITIAL_SESSION event — which fires AFTER plugin setup.
// Its synchronous `global-auth` route middleware runs first, sees a null
// session, and wrongly redirects an authenticated user to /auth/login.
//
// SSR builds don't hit this: the server plugin restores the session from the
// cookie before the first render. SPA builds (self-hosted, ssr:false) do.
//
// This awaited client plugin runs right after the supabase plugin and before
// any route middleware, so it restores the session from the cookie first. It's
// a no-op when the session is already present (SaaS / soft navigations).
export default defineNuxtPlugin({
  name: 'supabase-session-init',
  enforce: 'post',
  dependsOn: ['supabase'],
  async setup() {
    const session = useSupabaseSession()
    if (session.value) return

    const client = useSupabaseClient()
    const { data } = await client.auth.getSession()
    if (data.session) {
      session.value = data.session
      // Keep the user ref in sync so guards that read it also see the user.
      const user = useSupabaseUser()
      if (!user.value) {
        const { data: claims } = await client.auth.getClaims()
        user.value = claims?.claims ?? null
      }
    }
  },
})
