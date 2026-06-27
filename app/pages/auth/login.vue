<template>
  <!-- A/B Test: Unified Auth -->
  <UnifiedAuth v-if="authVariant === 'test'" initial-mode="login" />

  <!-- Control: Original login form -->
  <div v-else class="space-y-6">
    <div class="flex justify-end">
      <Button variant="ghost" size="sm" @click="navigateTo('/')" class="text-sm">
        <Icon name="lucide:home" class="h-4 w-4 mr-2" />
        Back to Home
      </Button>
    </div>
    <div class="space-y-2 text-center">
      <h1 class="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p class="text-sm text-muted-foreground">
        Enter your email to sign in to your account
      </p>
    </div>
    <form @submit.prevent="handleLogin" class="space-y-4">
      <div class="space-y-2">
        <label for="email" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Email
        </label>
        <Input 
          id="email" 
          v-model="email" 
          type="email" 
          placeholder="m@example.com" 
          required 
          :disabled="loading"
          autocomplete="email"
          aria-label="Email address"
        />
      </div>
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label for="password" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Password
          </label>
          <NuxtLink to="/auth/forgot-password" tabindex="-1" class="text-sm text-primary hover:text-primary/90 hover:underline">
            Forgot password?
          </NuxtLink>
        </div>
        <Input 
          id="password" 
          v-model="password" 
          type="password" 
          required 
          :disabled="loading"
          autocomplete="current-password"
          aria-label="Password"
        />
      </div>
      <Button type="submit" class="w-full" :loading="loading">
        Sign In
      </Button>
    </form>
    <div class="relative">
      <div class="absolute inset-0 flex items-center">
        <span class="w-full border-t"></span>
      </div>
      <div class="relative flex justify-center text-xs uppercase">
        <span class="bg-card px-2 text-muted-foreground">Or continue with</span>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <Button variant="outline" class="w-full" @click="handleGithubLogin" :disabled="loading">
        <Icon name="lucide:github" class="mr-2 h-4 w-4" />
        GitHub
      </Button>
      <Button variant="outline" class="w-full" @click="handleGoogleLogin" :disabled="loading">
        <Icon name="logos:google-icon" class="mr-2 h-4 w-4" />
        Google
      </Button>
    </div>
    <div class="text-center text-sm">
      Don't have an account?
      <NuxtLink :to="redirectUrl ? `/auth/register?redirect=${encodeURIComponent(redirectUrl)}` : '/auth/register'" class="text-primary hover:text-primary/90 hover:underline font-medium ml-1">
        Sign up
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'auth'
})

import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import UnifiedAuth from '@/components/auth/UnifiedAuth.vue'

const route = useRoute()
const client = useSupabaseClient()
const { $toast } = useNuxtApp()
const { track, identify, getFeatureFlag, onFeatureFlags } = usePostHog()
const { signInWithLockout } = useAuthWithLockout()
const { logAuthEvent } = useAuthAudit()

// A/B test flag
const authVariant = ref('control')
onMounted(() => {
  onFeatureFlags(() => {
    authVariant.value = (getFeatureFlag('cro-unified-auth-page')) || 'control'
  })
})

// Redirect URL from invitation flow
const redirectUrl = computed(() => {
  const r = String(route.query.redirect || '')
  return r && r.startsWith('/') ? r : null
})

const email = ref('')
const password = ref('')
const loading = ref(false)

const handleLogin = async () => {
  loading.value = true

  try {
    await signInWithLockout(email.value, password.value)

    // Track login
    const { data: { user } } = await client.auth.getUser()
    if (user) {
      identify(user.id, {
        email: email.value,
        $set: {
          current_plan: 'unknown',
        },
        $set_once: {
          signup_method: 'email',
        },
      })
      track('user_logged_in', {
        email: email.value,
        login_method: 'email'
      })
    }
    logAuthEvent('login_success', true, { method: 'email' })

    // Redirect to MFA challenge if user has TOTP enrolled
    const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel === 'aal1') {
      navigateTo('/auth/mfa')
      return
    }

    $toast.success('Logged in successfully')
    navigateTo(redirectUrl.value || '/dashboard')
  } catch (error) {
    logAuthEvent('login_failure', false, { reason: error.message }, email.value)
    $toast.error(error.message || 'Failed to login')
  } finally {
    loading.value = false
  }
}

const getOAuthCallbackUrl = () => {
  const base = `${window.location.origin}/auth/callback`
  return redirectUrl.value
    ? `${base}?redirect=${encodeURIComponent(redirectUrl.value)}`
    : base
}

const handleGithubLogin = async () => {
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: getOAuthCallbackUrl()
      }
    })

    if (error) throw error
  } catch (error) {
    $toast.error('Failed to login with GitHub')
    console.error(error)
  }
}

const handleGoogleLogin = async () => {
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getOAuthCallbackUrl()
      }
    })

    if (error) throw error
  } catch (error) {
    $toast.error('Failed to login with Google')
    console.error(error)
  }
}
</script>