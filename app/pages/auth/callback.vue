<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="flex justify-center mb-4">
        <Icon name="lucide:loader-2" class="animate-spin h-8 w-8 text-primary" />
      </div>
      <h2 class="text-xl font-semibold mb-2">Authenticating...</h2>
      <p class="text-muted-foreground">Please wait while we complete the authentication process.</p>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'auth'
})

const route = useRoute()
const client = useSupabaseClient()
const { track, identify, register: registerProps } = usePostHog()
const { logAuthEvent } = useAuthAudit()
const { getCampaignParams } = useTrackingParams()

// Handle the OAuth callback
onMounted(async () => {
  // Verify user with the server (getUser() validates JWT, getSession() does not)
  const { data: { user: verifiedUser }, error } = await client.auth.getUser()

  if (error || !verifiedUser) {
    console.error('Auth callback error:', error)
    await navigateTo('/auth/login')
    return
  }

  const provider = verifiedUser.app_metadata?.provider || 'unknown'
  const campaignParams = getCampaignParams()
  // A Supabase user row is created on first OAuth sign-in, so a recently-created
  // account means this callback is a genuine new signup rather than a returning
  // user logging in. Used to avoid firing the signup event on every OAuth login.
  const isNewSignup = Date.now() - new Date(verifiedUser.created_at).getTime() < 60_000
  identify(verifiedUser.id, {
    $set: {
      email: verifiedUser.email,
      signup_method: provider,
      created_at: verifiedUser.created_at,
    },
    $set_once: { ...campaignParams },
  })
  if (campaignParams) registerProps(campaignParams)

  if (isNewSignup) {
    // Genuine new OAuth signup — fire the same signals as the email signup paths.
    track('oauth_signup_completed', {
      provider,
      email: verifiedUser.email,
      ...campaignParams,
    })
    track('user_signed_up', {
      email: verifiedUser.email,
      signup_method: provider,
      ...campaignParams,
    })
    logAuthEvent('signup', true, { method: provider })
    // GTM/Google Ads signup conversion — only on a real signup, never on login.
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event: 'user_signed_up' })
  } else {
    // Returning user logging in via OAuth — track as a login, not a signup.
    track('user_logged_in', {
      email: verifiedUser.email,
      login_method: provider,
    })
    logAuthEvent('login_success', true, { method: provider })
  }

  // Check for redirect param (e.g., from invitation flow)
  const redirect = String(route.query.redirect || '')
  if (redirect && redirect.startsWith('/')) {
    await navigateTo(redirect)
    return
  }

  // Redirect to dashboard - middleware will handle onboarding redirect if needed
  await navigateTo('/dashboard')
})
</script>