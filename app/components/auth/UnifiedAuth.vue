<template>
  <div class="space-y-6">
    <div class="flex justify-end">
      <Button variant="ghost" size="sm" @click="navigateTo('/')" class="text-sm">
        <Icon name="lucide:home" class="h-4 w-4 mr-2" />
        Back to Home
      </Button>
    </div>

    <!-- Mode Toggle -->
    <div class="flex rounded-lg border bg-muted p-1">
      <button
        type="button"
        :class="[
          'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all',
          mode === 'signup'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        ]"
        @click="switchMode('signup')"
      >
        Sign up
      </button>
      <button
        type="button"
        :class="[
          'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all',
          mode === 'login'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        ]"
        @click="switchMode('login')"
      >
        Log in
      </button>
    </div>

    <!-- Header -->
    <div class="space-y-2 text-center">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ mode === 'signup' ? 'Create an account' : 'Welcome back' }}
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ mode === 'signup' ? 'Enter your details below to create your account' : 'Enter your email to sign in to your account' }}
      </p>
    </div>

    <!-- OAuth -->
    <div class="grid grid-cols-2 gap-4">
      <Button variant="outline" class="w-full" @click="handleOAuth('github')" :disabled="isDisabled || !isHydrated">
        <Icon name="lucide:github" class="mr-2 h-4 w-4" />
        GitHub
      </Button>
      <Button variant="outline" class="w-full" @click="handleOAuth('google')" :disabled="isDisabled || !isHydrated">
        <Icon name="logos:google-icon" class="mr-2 h-4 w-4" />
        Google
      </Button>
    </div>

    <!-- Divider -->
    <div class="relative">
      <div class="absolute inset-0 flex items-center">
        <span class="w-full border-t"></span>
      </div>
      <div class="relative flex justify-center text-xs uppercase">
        <span class="bg-card px-2 text-muted-foreground">Or with email</span>
      </div>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="space-y-2">
        <label for="unified-email" class="text-sm font-medium leading-none">
          Email
        </label>
        <Input
          id="unified-email"
          v-model="email"
          type="email"
          placeholder="m@example.com"
          required
          :disabled="isDisabled || !isHydrated"
          autocomplete="email"
          aria-label="Email address"
        />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label for="unified-password" class="text-sm font-medium leading-none">
            Password
          </label>
          <NuxtLink
            v-if="mode === 'login'"
            to="/auth/forgot-password"
            tabindex="-1"
            class="text-sm text-primary hover:text-primary/90 hover:underline"
          >
            Forgot password?
          </NuxtLink>
        </div>
        <PasswordInput
          v-if="mode === 'signup'"
          input-id="unified-password"
          v-model="password"
          placeholder="Create a strong password"
          :disabled="isDisabled || !isHydrated"
          :show-strength="true"
          autocomplete="new-password"
          aria-label="Password"
        />
        <Input
          v-else
          id="unified-password"
          v-model="password"
          type="password"
          required
          :disabled="isDisabled || !isHydrated"
          autocomplete="current-password"
          aria-label="Password"
        />
      </div>

      <!-- Terms checkbox (signup only) -->
      <div v-if="mode === 'signup'" class="flex items-start space-x-2">
        <input
          id="unified-acceptTerms"
          v-model="acceptedTerms"
          type="checkbox"
          :disabled="isDisabled || !isHydrated"
          class="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          required
        />
        <label for="unified-acceptTerms" class="text-sm text-gray-700 dark:text-gray-300">
          I accept the
          <NuxtLink to="/terms" target="_blank" class="text-primary hover:text-primary/90 hover:underline font-medium mx-1">
            Terms of Service
          </NuxtLink>
          and
          <NuxtLink to="/privacy" target="_blank" class="text-primary hover:text-primary/90 hover:underline font-medium mx-1">
            Privacy Policy
          </NuxtLink>
        </label>
      </div>

      <!-- Error display -->
      <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-800 dark:text-red-200">
        {{ error }}
      </div>

      <Button
        type="submit"
        class="w-full"
        :loading="isLoading"
        :disabled="!isHydrated || (mode === 'signup' && !isFormValid) || isDisabled"
      >
        {{ mode === 'signup' ? 'Create Account' : 'Sign In' }}
      </Button>
    </form>

    <!-- Footer text -->
    <p class="text-center text-xs text-muted-foreground">
      By clicking continue, you agree to our
      <NuxtLink to="/terms" class="hover:text-foreground hover:underline mx-1">
        Terms of Service
      </NuxtLink>
      and
      <NuxtLink to="/privacy" class="hover:text-foreground hover:underline mx-1">
        Privacy Policy
      </NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import PasswordInput from '@/components/ui/PasswordInput.vue'
import { validatePassword } from '~/composables/usePasswordValidation'
import { useFormLoading } from '~/composables/useFormLoading'

const props = defineProps<{
  initialMode: 'signup' | 'login'
}>()

const route = useRoute()
const client = useSupabaseClient()
const { $toast } = useNuxtApp()
const { track, identify, register: registerProps } = usePostHog()
const { getCampaignParams } = useTrackingParams()
const { logAuthEvent } = useAuthAudit()
const { signInWithLockout } = useAuthWithLockout()

const mode = ref<'signup' | 'login'>(props.initialMode)

// Redirect URL from invitation flow
const redirectUrl = computed(() => {
  const r = String(route.query.redirect || '')
  return r && r.startsWith('/') ? r : null
})

// Form state
const email = ref('')
const password = ref('')
const acceptedTerms = ref(false)

const { isLoading, isDisabled, error, withLoading } = useFormLoading()
const isHydrated = ref(false)

onMounted(() => {
  isHydrated.value = true
})

// Signup validation
const passwordValidation = computed(() => validatePassword(password.value))

const isFormValid = computed(() => {
  return (
    email.value.length > 0 &&
    passwordValidation.value.isValid &&
    acceptedTerms.value
  )
})

function switchMode(newMode: 'signup' | 'login') {
  if (newMode === mode.value) return
  const from = mode.value
  mode.value = newMode
  error.value = null
  track('auth_mode_toggled', { from, to: newMode })
}

function handleSubmit() {
  if (mode.value === 'signup') {
    handleRegister()
  } else {
    handleLogin()
  }
}

// --- Signup logic (from register.vue) ---
async function handleRegister() {
  track('auth_started', { method: 'email', flow: 'signup' })
  if (!passwordValidation.value.isValid) {
    $toast.error('Password does not meet requirements')
    return
  }
  if (!acceptedTerms.value) {
    $toast.error('You must accept the Terms of Service and Privacy Policy')
    return
  }

  await withLoading(async () => {
    const { error: signUpError } = await client.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          accepted_terms: true,
          accepted_terms_date: new Date().toISOString()
        }
      }
    })
    if (signUpError) throw signUpError

    const { error: signInError } = await client.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })
    if (signInError) throw signInError

    const { data: { user } } = await client.auth.getUser()
    if (user) {
      const campaignParams = getCampaignParams()
      identify(user.id, { email: email.value })
      if (campaignParams) registerProps(campaignParams)
      track('user_signed_up', {
        email: email.value,
        signup_method: 'email',
        ...campaignParams,
      })
      window.dataLayer = window.dataLayer || []
      window.dataLayer.push({ event: 'user_signed_up' })
    }

    logAuthEvent('signup', true, { method: 'email' })
    $toast.success('Account created successfully!')
    if (redirectUrl.value) {
      await navigateTo(redirectUrl.value)
    } else {
      await navigateTo('/auth/callback')
    }
  })
}

// --- Login logic (from login.vue) ---
async function handleLogin() {
  isLoading.value = true
  error.value = null

  try {
    await signInWithLockout(email.value, password.value)

    const { data: { user } } = await client.auth.getUser()
    if (user) {
      identify(user.id, {
        email: email.value,
        $set: { current_plan: 'unknown' },
        $set_once: { signup_method: 'email' },
      })
      track('user_logged_in', {
        email: email.value,
        login_method: 'email'
      })
    }
    logAuthEvent('login_success', true, { method: 'email' })

    // MFA check
    const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel === 'aal1') {
      navigateTo('/auth/mfa')
      return
    }

    $toast.success('Logged in successfully')
    navigateTo(redirectUrl.value || '/dashboard')
  } catch (err: any) {
    logAuthEvent('login_failure', false, { reason: err.message }, email.value)
    error.value = err.message || 'Failed to login'
    $toast.error(err.message || 'Failed to login')
  } finally {
    isLoading.value = false
  }
}

// --- OAuth ---
const getOAuthCallbackUrl = () => {
  const base = `${window.location.origin}/auth/callback`
  return redirectUrl.value
    ? `${base}?redirect=${encodeURIComponent(redirectUrl.value)}`
    : base
}

async function handleOAuth(provider: 'github' | 'google') {
  track('auth_started', { method: provider, flow: 'signup' })
  // Signup mode requires terms acceptance
  if (mode.value === 'signup' && !acceptedTerms.value) {
    $toast.error('Please accept the Terms of Service and Privacy Policy before continuing')
    return
  }

  try {
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getOAuthCallbackUrl()
      }
    })
    if (error) throw error
  } catch (err) {
    $toast.error(`Failed to ${mode.value === 'signup' ? 'sign up' : 'login'} with ${provider === 'github' ? 'GitHub' : 'Google'}`)
    console.error(err)
  }
}
</script>
