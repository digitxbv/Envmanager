// Runs as early as possible (00. prefix) so the secret-share decryption key in the
// URL #fragment is moved into an in-memory stash and removed from the address bar
// BEFORE any analytics (PostHog autocapture, Sentry, GTM/GA) can read location.href.
// Without this, the AES key leaks to third-party analytics and the zero-knowledge
// guarantee is broken. See app/pages/share/[id].vue.
export default defineNuxtPlugin((nuxtApp) => {
  if (typeof window === 'undefined') return

  const capture = () => {
    const { pathname, hash, search } = window.location
    if (pathname.startsWith('/share/') && hash.length > 1) {
      if (!shareKeyStash.value) shareKeyStash.value = hash.slice(1)
      // Strip the fragment without adding a history entry.
      window.history.replaceState(window.history.state, '', pathname + search)
    }
  }

  // Strip immediately (before analytics scripts read location.href)…
  capture()
  // …and again once the Vue Router has resolved the initial route, since the router
  // re-syncs the address bar (including the hash) during hydration.
  nuxtApp.hook('app:mounted', capture)
  nuxtApp.hook('page:finish', capture)
})
