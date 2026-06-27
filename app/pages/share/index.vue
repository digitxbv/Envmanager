<template>
  <div class="container max-w-2xl py-12 md:py-16">
    <div class="mb-8 text-center">
      <h1 class="text-3xl font-bold tracking-tight md:text-4xl">Share a Secret Securely</h1>
      <p class="mt-3 text-muted-foreground">
        Send a password, API key, or token via a one-time link that
        <strong>self-destructs after it's viewed</strong>. Encrypted in your browser —
        we never see the contents.
      </p>
    </div>

    <!-- Create form -->
    <div v-if="!shareUrl" class="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <label for="secret" class="mb-2 block text-sm font-medium">Your secret</label>
      <textarea
        id="secret"
        v-model="secret"
        rows="5"
        placeholder="Paste the password, API key, or message you want to share…"
        class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
      />

      <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label class="text-sm font-medium" for="ttl">Expires after</label>
        <select
          id="ttl"
          v-model="ttl"
          class="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option :value="3600">1 hour</option>
          <option :value="86400">1 day</option>
          <option :value="604800">7 days</option>
          <option :value="2592000">30 days</option>
        </select>
      </div>

      <p v-if="error" class="mt-4 text-sm text-red-500">{{ error }}</p>

      <button
        type="button"
        :disabled="loading || !secret.trim()"
        class="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
        @click="createLink"
      >
        <Icon v-if="loading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
        {{ loading ? 'Encrypting…' : 'Create one-time link' }}
      </button>

      <p class="mt-4 text-center text-xs text-muted-foreground">
        Zero-knowledge: the decryption key stays in the link (after the&nbsp;<code>#</code>) and is never sent to our servers.
      </p>
    </div>

    <!-- Result -->
    <div v-else class="ph-no-capture rounded-xl border border-primary/30 bg-primary/5 p-6 shadow-sm">
      <div class="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
        <Icon name="lucide:check-circle" class="h-5 w-5" />
        Your one-time link is ready
      </div>
      <div class="flex items-stretch gap-2">
        <input
          ref="linkInput"
          :value="shareUrl"
          readonly
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          @focus="selectLink"
        />
        <button
          type="button"
          class="shrink-0 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          @click="copyLink"
        >
          {{ copied ? 'Copied!' : 'Copy' }}
        </button>
      </div>
      <p class="mt-4 text-sm text-muted-foreground">
        This link can be opened <strong>once</strong>, then the secret is permanently deleted.
        It also expires automatically after the time you chose.
      </p>
      <button
        type="button"
        class="mt-6 inline-flex items-center text-sm font-medium text-primary hover:underline"
        @click="reset"
      >
        <Icon name="lucide:plus" class="mr-1 h-4 w-4" />
        Share another secret
      </button>
    </div>

    <!-- Product tie-in -->
    <div class="mt-10 rounded-xl border border-border/60 bg-card p-6 text-center">
      <h2 class="text-lg font-semibold">Sharing secrets one link at a time doesn't scale</h2>
      <p class="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        For your team's real secrets — API keys, database URLs, environment variables —
        EnvManager keeps them encrypted, access-controlled, and synced across every environment.
      </p>
      <NuxtLink
        to="/auth/register"
        class="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
      >
        Start your free trial
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const { encrypt, isSupported } = useSecretShare()
const config = useRuntimeConfig()
const siteUrl = (config.public.siteUrl as string) || 'https://envmanager.com'

const secret = ref('')
const ttl = ref(604800)
const loading = ref(false)
const error = ref('')
const shareUrl = ref('')
const copied = ref(false)
const linkInput = ref<HTMLInputElement | null>(null)

async function createLink() {
  error.value = ''
  if (!secret.value.trim()) return
  if (!isSupported()) {
    error.value = 'Your browser does not support secure encryption (Web Crypto). Try a modern browser over HTTPS.'
    return
  }
  loading.value = true
  try {
    const { ciphertext, iv, keyB64 } = await encrypt(secret.value)
    const { data, error: rpcError } = await supabase.rpc('create_shared_secret', {
      p_ciphertext: ciphertext,
      p_iv: iv,
      p_ttl_seconds: ttl.value,
    })
    if (rpcError || !data) throw rpcError || new Error('Failed to create link')
    shareUrl.value = `${siteUrl}/share/${data}#${keyB64}`
    secret.value = ''
  } catch (e: any) {
    error.value = e?.message || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

function selectLink() {
  linkInput.value?.select()
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
  } catch {
    selectLink()
    document.execCommand('copy')
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function reset() {
  shareUrl.value = ''
  copied.value = false
  error.value = ''
}

useSeoMeta({
  title: 'Share a Secret Securely — One-Time Encrypted Links | EnvManager',
  description:
    'Share passwords, API keys, and secrets via a one-time, end-to-end encrypted link that self-destructs after viewing. Free, no signup, zero-knowledge.',
  ogTitle: 'Share a Secret Securely — One-Time Encrypted Links',
  ogDescription:
    'Send a password or API key via a self-destructing, browser-encrypted link. Free, no signup required.',
})
</script>
