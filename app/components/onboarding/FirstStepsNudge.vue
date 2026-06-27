<template>
  <div v-if="!dismissed" class="rounded-lg border border-border bg-muted/30 p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1 space-y-2.5">
        <div class="space-y-0.5">
          <h3 class="text-sm font-medium text-foreground">Push these where they run</h3>
          <p class="text-xs text-muted-foreground">Connect a platform to sync your variables automatically.</p>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <NuxtLink
            v-for="provider in providers"
            :key="provider"
            :to="integrationsPath"
            class="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            {{ provider }}
          </NuxtLink>
          <NuxtLink
            :to="integrationsPath"
            class="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            See all →
          </NuxtLink>
        </div>

        <p class="text-xs text-muted-foreground">
          or pull locally —
          <span class="font-mono text-foreground">{{ PULL_CMD }}</span>
          <button
            type="button"
            class="ml-1 align-middle text-muted-foreground hover:text-foreground"
            :aria-label="copied ? 'Copied' : 'Copy command'"
            @click="copyCmd"
          >
            <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" class="h-3.5 w-3.5" />
          </button>
        </p>
      </div>

      <button
        type="button"
        class="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
        @click="dismiss"
      >
        <Icon name="lucide:x" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ projectId: string }>()

const providers = ['Vercel', 'Railway', 'Render', 'Dokploy', 'Coolify', 'GitHub Actions']
const integrationsPath = computed(() => `/dashboard/projects/${props.projectId}/integrations`)

const PULL_CMD = 'npx @envmanager-cli/cli pull'

const { track } = usePostHog()
const copied = ref(false)
const dismissed = ref(false)

const dismissKey = computed(() => `envman:nudge-dismissed:${props.projectId}`)

const copyCmd = async () => {
  try {
    await navigator.clipboard.writeText(PULL_CMD)
    copied.value = true
    track('activation_nudge_cli_copied', {})
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* clipboard unavailable — no-op */ }
}

const dismiss = () => {
  dismissed.value = true
  if (import.meta.client) localStorage.setItem(dismissKey.value, '1')
  track('activation_nudge_dismissed', {})
}

onMounted(() => {
  if (import.meta.client && localStorage.getItem(dismissKey.value) === '1') {
    dismissed.value = true
    return
  }
  track('activation_nudge_shown', {})
})
</script>
