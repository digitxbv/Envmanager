<template>
  <div class="space-y-6">
    <div class="space-y-2 text-center">
      <div class="flex justify-center mb-4">
        <Icon name="lucide:terminal" class="h-12 w-12 text-primary" />
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">CLI Authentication</h1>
      <p class="text-sm text-muted-foreground">
        Sign in to authorize the EnvManager CLI
      </p>
    </div>

    <div v-if="generatedKey" class="space-y-4 text-center py-4">
      <div class="flex justify-center mb-2">
        <Icon name="lucide:check-circle" class="h-10 w-10 text-green-500" />
      </div>
      <p class="text-sm text-muted-foreground">Copy this code and paste it into your terminal:</p>
      <div class="relative">
        <code class="block bg-muted p-4 rounded-lg text-sm font-mono break-all select-all">{{ generatedKey }}</code>
        <button
          @click="copyKey"
          class="absolute top-2 right-2 p-1.5 rounded-md hover:bg-accent transition-colors"
          :title="keyCopied ? 'Copied!' : 'Copy to clipboard'"
        >
          <Icon :name="keyCopied ? 'lucide:check' : 'lucide:copy'" class="h-4 w-4" />
        </button>
      </div>
      <p class="text-xs text-muted-foreground">You can close this window after pasting the code.</p>
    </div>

    <div v-else-if="authenticating" class="text-center py-8">
      <Icon name="lucide:loader-2" class="animate-spin h-8 w-8 text-primary mx-auto mb-4" />
      <p class="text-muted-foreground">Completing authentication...</p>
    </div>

    <template v-else>
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div class="space-y-2">
          <label for="email" class="text-sm font-medium">Email</label>
          <Input 
            id="email" 
            v-model="email" 
            type="email" 
            placeholder="m@example.com" 
            required 
            :disabled="loading"
          />
        </div>
        <div class="space-y-2">
          <label for="password" class="text-sm font-medium">Password</label>
          <Input 
            id="password" 
            v-model="password" 
            type="password" 
            required 
            :disabled="loading"
          />
        </div>
        <Button type="submit" class="w-full" :loading="loading">
          Sign In & Authorize CLI
        </Button>
      </form>

      <template v-if="oauth.any">
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <span class="w-full border-t"></span>
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <div class="grid gap-4" :class="oauth.github && oauth.google ? 'grid-cols-2' : 'grid-cols-1'">
          <Button v-if="oauth.github" variant="outline" class="w-full" @click="handleOAuthLogin('github')" :disabled="loading">
            <Icon name="lucide:github" class="mr-2 h-4 w-4" />
            GitHub
          </Button>
          <Button v-if="oauth.google" variant="outline" class="w-full" @click="handleOAuthLogin('google')" :disabled="loading">
            <Icon name="logos:google-icon" class="mr-2 h-4 w-4" />
            Google
          </Button>
        </div>
      </template>

      <p class="text-xs text-center text-muted-foreground">
        {{ isManualMode ? 'After signing in, a code will be shown for you to paste into your terminal.' : 'After signing in, you\'ll be redirected back to your terminal.' }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { oauthVisibility } from '~/utils/selfHosted'

const client = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()
const { $toast } = useNuxtApp()

// Which OAuth buttons to show (self-hosted hides unconfigured providers).
const config = useRuntimeConfig()
const oauth = oauthVisibility(
  Boolean(config.public.selfHosted),
  Boolean(config.public.oauthGithubEnabled),
  Boolean(config.public.oauthGoogleEnabled),
)

const email = ref('')
const password = ref('')
const loading = ref(false)
const authenticating = ref(false)
const generatedKey = ref('')
const keyCopied = ref(false)

const redirectUri = computed(() => route.query.redirect_uri as string || '')
const state = computed(() => route.query.state as string || '')
const isManualMode = computed(() => route.query.mode === 'manual')

const isValidRedirect = computed(() => {
  if (isManualMode.value) return true
  if (!redirectUri.value) return false
  try {
    const url = new URL(redirectUri.value)
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch {
    return false
  }
})

async function copyKey() {
  try {
    await navigator.clipboard.writeText(generatedKey.value)
    keyCopied.value = true
    setTimeout(() => { keyCopied.value = false }, 2000)
  } catch {
    // Fallback: select the code element text
  }
}

async function redirectToCLI() {
  if (!isValidRedirect.value) {
    $toast.error('Invalid redirect URI')
    return
  }

  authenticating.value = true

  try {
    // Create CLI session API key instead of sharing session tokens
    const { data: keyData, error: keyError } = await client.rpc('create_cli_session_key')

    if (keyError || !keyData) {
      throw new Error(keyError?.message || 'Failed to create CLI session key')
    }

    const key = (keyData as { key: string }).key

    // Manual mode: show the key on screen instead of redirecting
    if (isManualMode.value) {
      generatedKey.value = key
      authenticating.value = false
      return
    }

    // Browser mode: redirect to CLI's local callback server
    const callbackUrl = new URL(redirectUri.value)
    callbackUrl.searchParams.set('api_key', key)
    if (state.value) {
      callbackUrl.searchParams.set('state', state.value)
    }

    window.location.href = callbackUrl.toString()
  } catch (error: any) {
    authenticating.value = false
    $toast.error(error.message || 'Failed to complete CLI authentication')
  }
}

async function handleLogin() {
  if (!isValidRedirect.value) {
    $toast.error('Invalid CLI callback URL')
    return
  }

  loading.value = true

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })

    if (error) throw error
    if (!data.session) throw new Error('No session returned')

    await redirectToCLI()
  } catch (error: any) {
    $toast.error(error.message || 'Failed to login')
  } finally {
    loading.value = false
  }
}

async function handleOAuthLogin(provider: 'github' | 'google') {
  if (!isValidRedirect.value) {
    $toast.error('Invalid CLI callback URL')
    return
  }

  sessionStorage.setItem('cli_auth_redirect', redirectUri.value)
  sessionStorage.setItem('cli_auth_state', state.value)
  if (isManualMode.value) {
    sessionStorage.setItem('cli_auth_mode', 'manual')
  }

  try {
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/cli-callback`
      }
    })

    if (error) throw error
  } catch (error: any) {
    $toast.error(`Failed to login with ${provider}`)
  }
}

onMounted(async () => {
  if (!isValidRedirect.value) {
    $toast.error('Missing or invalid redirect_uri. This page should be opened by the CLI.')
    return
  }

  // If user is already logged in, create API key and redirect/show key
  if (user.value) {
    await redirectToCLI()
  }
})
</script>
