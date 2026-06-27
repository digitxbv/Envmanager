<template>
  <!-- Self-hosted gate: notice replaces ALL registration UI when blocked -->
  <div v-if="gateChecked && !registrationAllowed" class="space-y-6">
    <div class="flex justify-end">
      <Button variant="ghost" size="sm" @click="navigateTo('/')" class="text-sm">
        <Icon name="lucide:home" class="h-4 w-4 mr-2" />
        Back to Home
      </Button>
    </div>
    <div class="rounded-md border border-border bg-muted/40 p-6 text-center">
      <Icon name="lucide:lock" class="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h2 class="text-base font-semibold">Registration is invite-only</h2>
      <p class="mt-2 text-sm text-muted-foreground">
        This self-hosted EnvManager instance only allows new accounts by admin invitation.
        Ask an administrator to send you an invite link.
      </p>
      <NuxtLink to="/auth/login" class="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        Back to login
      </NuxtLink>
    </div>
  </div>

  <!-- A/B split: only renders when gate is open (SaaS always, self-hosted first-user only) -->
  <template v-else>
    <!-- A/B Test: Unified Auth -->
    <UnifiedAuth v-if="authVariant === 'test'" initial-mode="signup" />

    <!-- Control: Original register form -->
    <div v-else class="space-y-6">
      <div class="flex justify-end">
        <Button variant="ghost" size="sm" @click="navigateTo('/')" class="text-sm">
          <Icon name="lucide:home" class="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </div>
      <div class="space-y-2 text-center">
        <h1 class="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p class="text-sm text-muted-foreground">
          Enter your details below to create your account
        </p>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <Button variant="outline" class="w-full" @click="handleGithubSignup" :disabled="isDisabled || !isHydrated">
          <Icon name="lucide:github" class="mr-2 h-4 w-4" />
          GitHub
        </Button>
        <Button variant="outline" class="w-full" @click="handleGoogleSignup" :disabled="isDisabled || !isHydrated">
          <Icon name="logos:google-icon" class="mr-2 h-4 w-4" />
          Google
        </Button>
      </div>
      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <span class="w-full border-t"></span>
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-card px-2 text-muted-foreground">Or with email</span>
        </div>
      </div>
      <form @submit.prevent="handleRegister" class="space-y-4">
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
            :disabled="isDisabled || !isHydrated"
            autocomplete="email"
            aria-label="Email address"
          />
        </div>
        <div class="space-y-2">
          <label for="password" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Password
          </label>
          <PasswordInput
            input-id="password"
            v-model="password"
            placeholder="Create a strong password"
            :disabled="isDisabled || !isHydrated"
            :show-strength="true"
            autocomplete="new-password"
            aria-label="Password"
          />
        </div>
        <div class="flex items-start space-x-2">
          <input
            id="acceptTerms"
            v-model="acceptedTerms"
            type="checkbox"
            :disabled="isDisabled || !isHydrated"
            class="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            required
          />
          <label for="acceptTerms" class="text-sm text-gray-700 dark:text-gray-300">
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
        <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-800 dark:text-red-200">
          {{ error }}
        </div>
        <Button
          type="submit"
          class="w-full"
          :loading="isLoading"
          :disabled="!isHydrated || !isFormValid || isDisabled"
        >
          Create Account
        </Button>
      </form>
      <div class="text-center text-sm">
        Already have an account?
        <NuxtLink :to="redirectUrl ? `/auth/login?redirect=${encodeURIComponent(redirectUrl)}` : '/auth/login'" class="text-primary hover:text-primary/90 hover:underline font-medium ml-1">
          Sign in
        </NuxtLink>
      </div>
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
</template>

<script setup>
definePageMeta({
  layout: 'auth'
})

import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import PasswordInput from '@/components/ui/PasswordInput.vue'
import UnifiedAuth from '@/components/auth/UnifiedAuth.vue'
import { validatePassword } from '~/composables/usePasswordValidation'
import { useFormLoading } from '~/composables/useFormLoading'
import { canRegister } from '~/utils/selfHosted'

const route = useRoute()
const client = useSupabaseClient()
const { $toast } = useNuxtApp()
const { track, identify, register: registerProps, getFeatureFlag, onFeatureFlags } = usePostHog()
const { getCampaignParams } = useTrackingParams()
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
const acceptedTerms = ref(false)

const { isLoading, isDisabled, error, withLoading } = useFormLoading()
const isHydrated = ref(false)

onMounted(() => {
  isHydrated.value = true
})

// Self-hosted registration gate
const config = useRuntimeConfig()
const selfHosted = Boolean(config.public.selfHosted)
const registrationAllowed = ref(true)
const gateChecked = ref(!selfHosted) // SaaS needs no gate check

onMounted(async () => {
  if (!selfHosted) return
  try {
    const { data, error } = await client.rpc('is_first_user')
    registrationAllowed.value = canRegister(selfHosted, error ? false : Boolean(data))
  } catch {
    // Fail closed in self-hosted mode: if we can't confirm first-user, require an invite.
    registrationAllowed.value = false
  } finally {
    gateChecked.value = true
  }
})

// Computed validation
const passwordValidation = computed(() => validatePassword(password.value))

const isFormValid = computed(() => {
  return (
    email.value.length > 0 &&
    passwordValidation.value.isValid &&
    acceptedTerms.value
  )
})

const handleRegister = async () => {
  if (!registrationAllowed.value) {
    $toast.error('Registration is invite-only on this instance. Ask an admin to invite you.')
    return
  }
  // Client-side validation
  if (!passwordValidation.value.isValid) {
    $toast.error('Password does not meet requirements')
    return
  }

  if (!acceptedTerms.value) {
    $toast.error('You must accept the Terms of Service and Privacy Policy')
    return
  }

  await withLoading(async () => {
    track('auth_started', { method: 'email', flow: 'signup' })
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

    // Sign in immediately after signup
    const { error: signInError } = await client.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })

    if (signInError) throw signInError

    // Track signup
    const { data: { user } } = await client.auth.getUser()
    if (user) {
      const campaignParams = getCampaignParams()
      identify(user.id, {
        $set: { email: email.value },
        $set_once: { ...campaignParams },
      })
      if (campaignParams) registerProps(campaignParams)
      track('user_signed_up', {
        email: email.value,
        signup_method: 'email',
        ...campaignParams,
      })
      // Push to dataLayer for GTM (Google Ads conversion tracking)
      window.dataLayer = window.dataLayer || []
      window.dataLayer.push({ event: 'user_signed_up' })
    }

    logAuthEvent('signup', true, { method: 'email' })
    $toast.success('Account created successfully!')
    // Redirect to pending invitation or let callback handle onboarding
    if (redirectUrl.value) {
      await navigateTo(redirectUrl.value)
    } else {
      await navigateTo('/auth/callback')
    }
  })
}

const getOAuthCallbackUrl = () => {
  const base = `${window.location.origin}/auth/callback`
  return redirectUrl.value
    ? `${base}?redirect=${encodeURIComponent(redirectUrl.value)}`
    : base
}

const handleGithubSignup = async () => {
  if (!registrationAllowed.value) {
    $toast.error('Registration is invite-only on this instance. Ask an admin to invite you.')
    return
  }
  track('auth_started', { method: 'github', flow: 'signup' })
  if (!acceptedTerms.value) {
    $toast.error('Please accept the Terms of Service and Privacy Policy before continuing')
    return
  }

  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: getOAuthCallbackUrl()
      }
    })

    if (error) throw error
  } catch (error) {
    $toast.error('Failed to sign up with GitHub')
    console.error(error)
  }
}

const handleGoogleSignup = async () => {
  if (!registrationAllowed.value) {
    $toast.error('Registration is invite-only on this instance. Ask an admin to invite you.')
    return
  }
  track('auth_started', { method: 'google', flow: 'signup' })
  if (!acceptedTerms.value) {
    $toast.error('Please accept the Terms of Service and Privacy Policy before continuing')
    return
  }

  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getOAuthCallbackUrl()
      }
    })

    if (error) throw error
  } catch (error) {
    $toast.error('Failed to sign up with Google')
    console.error(error)
  }
}
</script>
