<template>
  <div class="space-y-6">
    <div class="flex justify-end">
      <Button variant="ghost" size="sm" @click="navigateTo('/auth/login')" class="text-sm">
        <Icon name="lucide:arrow-left" class="h-4 w-4 mr-2" />
        Back to Login
      </Button>
    </div>
    <div class="space-y-2 text-center">
      <h1 class="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p class="text-sm text-muted-foreground">
        Enter your email address and we'll send you a link to reset your password
      </p>
    </div>

    <div v-if="!emailSent">
      <form @submit.prevent="handleResetPassword" class="space-y-4">
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
            :disabled="isDisabled"
            autocomplete="email"
            aria-label="Email address"
          />
        </div>
        <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-800 dark:text-red-200">
          {{ error }}
        </div>
        <Button
          type="submit"
          class="w-full"
          :loading="isLoading"
          :disabled="isDisabled || !email"
        >
          Send Reset Link
        </Button>
      </form>
    </div>

    <div v-else class="text-center space-y-4">
      <div class="bg-green-50 dark:bg-green-900/20 rounded-full p-4 inline-flex">
        <Icon name="lucide:mail-check" class="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>
      <h2 class="text-xl font-medium">Check your email</h2>
      <p class="text-muted-foreground max-w-md mx-auto">
        We've sent a password reset link to <strong>{{ email }}</strong>.
        Click the link in the email to reset your password.
      </p>
      <div class="pt-4">
        <Button variant="outline" @click="emailSent = false">
          Send Another Link
        </Button>
      </div>
    </div>

    <div class="text-center text-sm">
      Remember your password?
      <NuxtLink to="/auth/login" class="text-primary hover:text-primary/90 hover:underline font-medium ml-1">
        Sign in
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
import { useFormLoading } from '~/composables/useFormLoading'

const client = useSupabaseClient()
const { $toast } = useNuxtApp()
const { track } = usePostHog()
const { logAuthEvent } = useAuthAudit()

const email = ref('')
const emailSent = ref(false)

const { isLoading, isDisabled, error, withLoading } = useFormLoading()

const handleResetPassword = async () => {
  await withLoading(async () => {
    const { error: resetError } = await client.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })

    if (resetError) throw resetError

    track('password_reset_requested', { email: email.value })
    logAuthEvent('password_reset_request', true, {}, email.value)

    emailSent.value = true
    $toast.success('Password reset email sent')
  })
}
</script>
