<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center max-w-md w-full px-4">
      <!-- Manual mode: show the key -->
      <template v-if="generatedKey">
        <div class="space-y-4">
          <div class="flex justify-center mb-2">
            <Icon name="lucide:check-circle" class="h-10 w-10 text-green-500" />
          </div>
          <h2 class="text-xl font-semibold mb-2">CLI Authentication Complete</h2>
          <p class="text-sm text-muted-foreground">Copy this code and paste it into your terminal:</p>
          <div class="relative">
            <code class="block bg-muted p-4 rounded-lg text-sm font-mono break-all select-all text-left">{{ generatedKey }}</code>
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
      </template>

      <!-- Default: loading spinner -->
      <template v-else>
        <div class="flex justify-center mb-4">
          <Icon name="lucide:loader-2" class="animate-spin h-8 w-8 text-primary" />
        </div>
        <h2 class="text-xl font-semibold mb-2">Completing CLI Authentication...</h2>
        <p class="text-muted-foreground">Please wait while we redirect you back to your terminal.</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const client = useSupabaseClient()
const { $toast } = useNuxtApp()

const generatedKey = ref('')
const keyCopied = ref(false)

async function copyKey() {
  try {
    await navigator.clipboard.writeText(generatedKey.value)
    keyCopied.value = true
    setTimeout(() => { keyCopied.value = false }, 2000)
  } catch {
    // Fallback: text is already select-all
  }
}

onMounted(async () => {
  const redirectUri = sessionStorage.getItem('cli_auth_redirect')
  const state = sessionStorage.getItem('cli_auth_state')
  const authMode = sessionStorage.getItem('cli_auth_mode')

  sessionStorage.removeItem('cli_auth_redirect')
  sessionStorage.removeItem('cli_auth_state')
  sessionStorage.removeItem('cli_auth_mode')

  const isManualMode = authMode === 'manual'

  if (!redirectUri && !isManualMode) {
    $toast.error('CLI authentication session not found')
    await navigateTo('/auth/login')
    return
  }

  // Validate redirect URI for non-manual mode
  if (!isManualMode) {
    try {
      const url = new URL(redirectUri!)
      if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        throw new Error('Invalid redirect URI')
      }
    } catch {
      $toast.error('Invalid CLI callback URL')
      await navigateTo('/auth/login')
      return
    }
  }

  await new Promise(resolve => setTimeout(resolve, 500))

  // Use getUser() to verify JWT server-side (getSession() only reads local storage)
  const { data: { user: verifiedUser }, error } = await client.auth.getUser()

  if (error || !verifiedUser) {
    $toast.error('Authentication failed')
    await navigateTo('/auth/login')
    return
  }

  // Create CLI session API key
  const { data: keyData, error: keyError } = await client.rpc('create_cli_session_key')

  if (keyError || !keyData) {
    $toast.error(keyError?.message || 'Failed to create CLI session key')
    await navigateTo('/auth/login')
    return
  }

  const key = (keyData as { key: string }).key

  // Manual mode: show key on screen
  if (isManualMode) {
    generatedKey.value = key
    return
  }

  // Browser mode: redirect to CLI's local callback server
  const callbackUrl = new URL(redirectUri!)
  callbackUrl.searchParams.set('api_key', key)
  if (state) {
    callbackUrl.searchParams.set('state', state)
  }

  window.location.href = callbackUrl.toString()
})
</script>
