<template>
  <div class="container max-w-2xl py-12 md:py-16">
    <div class="mb-8 text-center">
      <h1 class="text-3xl font-bold tracking-tight md:text-4xl">You've received a secret</h1>
      <p class="mt-3 text-muted-foreground">
        This is a one-time secret. Revealing it <strong>permanently deletes it</strong> — make sure
        you're ready to copy it now.
      </p>
    </div>

    <div class="ph-no-capture rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <!-- Before reveal -->
      <div v-if="state === 'idle'" class="text-center">
        <Icon name="lucide:lock" class="mx-auto h-10 w-10 text-primary" />
        <p v-if="!hasKey" class="mt-4 text-sm text-red-500">
          This link is missing its decryption key. It may have been copied incompletely —
          ask the sender to share the full link.
        </p>
        <button
          v-else
          type="button"
          class="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
          @click="reveal"
        >
          <Icon name="lucide:eye" class="mr-2 h-4 w-4" />
          Reveal secret
        </button>
      </div>

      <!-- Loading -->
      <div v-else-if="state === 'loading'" class="flex items-center justify-center py-6 text-sm text-muted-foreground">
        <Icon name="lucide:loader-2" class="mr-2 h-5 w-5 animate-spin" />
        Decrypting…
      </div>

      <!-- Revealed -->
      <div v-else-if="state === 'revealed'">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-sm font-medium">The secret</span>
          <button type="button" class="text-sm font-semibold text-primary hover:underline" @click="copySecret">
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
        <pre class="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-input bg-background px-3 py-2 text-sm font-mono">{{ plaintext }}</pre>
        <p class="mt-4 text-sm text-muted-foreground">
          This secret has now been deleted from our servers. Refreshing this page will show nothing.
        </p>
      </div>

      <!-- Gone / error -->
      <div v-else class="text-center">
        <Icon name="lucide:x-circle" class="mx-auto h-10 w-10 text-muted-foreground" />
        <p class="mt-4 text-sm text-muted-foreground">{{ errorMessage }}</p>
      </div>
    </div>

    <!-- Product tie-in -->
    <div class="mt-10 text-center">
      <p class="text-sm text-muted-foreground">
        Need to share secrets with your team regularly?
        <NuxtLink to="/share" class="text-primary hover:underline">Send your own one-time secret</NuxtLink>
        or
        <NuxtLink to="/auth/register" class="text-primary hover:underline">try EnvManager</NuxtLink>
        for encrypted, access-controlled secrets across every environment.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const supabase = useSupabaseClient()
const { decrypt, isValidKeyB64 } = useSecretShare()

const id = computed(() => route.params.id as string)
const keyB64 = ref('')
const hasKey = ref(false)
const state = ref<'idle' | 'loading' | 'revealed' | 'gone'>('idle')
const plaintext = ref('')
const copied = ref(false)
const errorMessage = ref('This secret is no longer available. It may have already been viewed or expired.')

onMounted(() => {
  // The decryption key lives in the URL fragment (#...), which is never sent to the
  // server. An early plugin moves it into shareKeyStash and strips it from the address
  // bar before analytics can read it; fall back to the raw hash if that didn't run.
  keyB64.value = shareKeyStash.value || window.location.hash.replace(/^#/, '')
  hasKey.value = keyB64.value.length > 0
})

async function reveal() {
  if (!hasKey.value) return
  // Validate the key BEFORE consuming — a truncated/corrupt link must not burn the
  // secret. Burning is irreversible, so we check decodability client-side first.
  if (!isValidKeyB64(keyB64.value)) {
    errorMessage.value =
      'This link is incomplete or corrupted. The secret has NOT been destroyed — ask the sender to resend the full link.'
    state.value = 'gone'
    return
  }
  state.value = 'loading'
  try {
    const { data, error } = await supabase.rpc('consume_shared_secret', { p_id: id.value })
    const row = Array.isArray(data) ? data[0] : null
    if (error || !row) {
      state.value = 'gone'
      return
    }
    plaintext.value = await decrypt(row.ciphertext, row.iv, keyB64.value)
    state.value = 'revealed'
  } catch {
    // The row is already burned at this point; decryption failed (wrong/corrupt key).
    errorMessage.value = 'Could not decrypt this secret. The link may be corrupted or the key is incorrect.'
    state.value = 'gone'
  }
}

async function copySecret() {
  try {
    await navigator.clipboard.writeText(plaintext.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* clipboard unavailable — user can select manually */
  }
}

// Ephemeral, per-recipient page — keep it out of the index.
useSeoMeta({
  title: 'View a one-time secret | EnvManager',
  robots: 'noindex, nofollow',
})
</script>
