<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"
      @click="close"
    >
      <div
        class="bg-card rounded-lg shadow-lg border w-full max-w-md overflow-hidden"
        @click.stop
      >
        <div class="p-6">
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium">Sync Now</h3>
            <button
              @click="close"
              class="text-muted-foreground hover:text-foreground transition-colors"
              :disabled="syncing"
            >
              <Icon name="lucide:x" class="h-5 w-5" />
            </button>
          </div>

          <!-- Loading state -->
          <div v-if="loading" class="flex justify-center py-8">
            <Icon name="lucide:loader-2" class="animate-spin h-5 w-5 text-primary" />
          </div>

          <!-- No integrations -->
          <div v-else-if="integrations.length === 0" class="py-6 text-center">
            <Icon name="lucide:plug" class="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p class="text-muted-foreground">
              No integrations configured for this environment
            </p>
            <NuxtLink
              :to="`/dashboard/projects/${projectId}/integrations`"
              class="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:text-primary/90 hover:underline transition-colors"
            >
              <Icon name="lucide:settings" class="h-4 w-4" />
              Configure Integrations
            </NuxtLink>
          </div>

          <!-- Integration list -->
          <div v-else class="space-y-4">
            <p class="text-sm text-muted-foreground">
              Syncing: <span class="font-medium text-foreground">{{ environmentName }}</span>
            </p>

            <div class="space-y-2">
              <div
                v-for="integration in integrations"
                :key="integration.id"
                class="flex items-center justify-between rounded-md border p-3"
                :class="{ 'opacity-50': syncing && !integration.selected }"
              >
                <div class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    v-model="integration.selected"
                    :disabled="syncing"
                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded text-white"
                    :style="{ backgroundColor: getPlatformColor(integration.platform) }"
                  >
                    <Icon :name="getPlatformIcon(integration.platform) || 'lucide:server'" class="h-4 w-4" />
                  </div>
                  <span class="font-medium capitalize">{{ integration.platform }}</span>
                </div>

                <div class="flex items-center gap-2">
                  <!-- Sync status -->
                  <Icon
                    v-if="integration.syncing"
                    name="lucide:loader-2"
                    class="animate-spin h-4 w-4 text-primary"
                  />
                  <Icon
                    v-else-if="integration.status === 'success'"
                    name="lucide:check-circle"
                     class="h-4 w-4 text-success-500"
                  />
                  <Icon
                    v-else-if="integration.status === 'partial'"
                    name="lucide:alert-triangle"
                    class="h-4 w-4 text-yellow-500"
                  />
                  <Icon
                    v-else-if="integration.status === 'error'"
                    name="lucide:x-circle"
                    class="h-4 w-4 text-destructive"
                  />

                  <!-- Last synced -->
                  <span v-if="!integration.syncing && !integration.status" class="text-xs text-muted-foreground">
                    {{ formatLastSynced(integration.lastSynced) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <Button variant="outline" @click="close" :disabled="syncing">
                Cancel
              </Button>
              <Button
                @click="handleSync"
                :loading="syncing"
                :disabled="syncing || selectedCount === 0"
              >
                Sync {{ selectedCount }} {{ selectedCount === 1 ? 'item' : 'items' }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '~/components/ui/Button.vue'

interface Integration {
  id: string
  platform: string
  envConfigId: string
  lastSynced: string | null
  selected: boolean
  syncing: boolean
  status: 'success' | 'partial' | 'error' | null
}

const props = defineProps<{
  open: boolean
  projectId: string
  environmentId: string
  environmentName: string
}>()

const emit = defineEmits<{
  close: []
  synced: []
}>()

const client = useSupabaseClient()
const { $toast } = useNuxtApp()

// State
const loading = ref(false)
const syncing = ref(false)
const integrations = ref<Integration[]>([])

// Computed
const selectedCount = computed(() => integrations.value.filter(i => i.selected).length)

// Platform display helpers
const platformConfig: Record<string, { icon: string; color: string }> = {
  vercel: { icon: 'lucide:globe', color: '#000000' },
  railway: { icon: 'lucide:git-branch', color: '#0B0D0E' },
  render: { icon: 'lucide:server', color: '#46E3B7' },
  dokploy: { icon: 'lucide:container', color: '#6366F1' },
  coolify: { icon: 'lucide:cloud', color: '#6B21A8' },
  github: { icon: 'lucide:github', color: '#181717' }
}

function getPlatformIcon(platform: string) {
  return platformConfig[platform]?.icon || 'lucide:plug'
}

function getPlatformColor(platform: string) {
  return platformConfig[platform]?.color || '#6B7280'
}

function formatLastSynced(date: string | null) {
  if (!date) return 'Never synced'

  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// Fetch integrations when modal opens
watch(() => props.open, async (isOpen) => {
  if (isOpen && props.environmentId) {
    await fetchIntegrations()
  }
})

async function fetchIntegrations() {
  loading.value = true
  integrations.value = []

  try {
    // Fetch platform integrations for this environment
    const { data: envConfigs, error: envError } = await client
      .from('environment_integration_configs')
      .select(`
        id,
        project_integration_id,
        last_synced_at,
        integration:platform_integrations!project_integration_id(
          id,
          platform
        )
      `)
      .eq('environment_id', props.environmentId)
      .eq('enabled', true)

    if (envError) throw envError

    // Add platform integrations
    for (const config of envConfigs || []) {
      const platform = (config.integration as any)?.platform
      if (platform) {
        integrations.value.push({
          id: config.project_integration_id,
          platform,
          envConfigId: config.id,
          lastSynced: config.last_synced_at,
          selected: true,
          syncing: false,
          status: null
        })
      }
    }

    // Fetch GitHub integrations (v1.1 env configs)
    const { data: githubConfigs, error: githubError } = await client
      .from('github_environment_configs')
      .select('id, last_synced_at')
      .eq('environment_id', props.environmentId)
      .eq('enabled', true)

    if (githubError) throw githubError

    // Add GitHub integrations
    for (const config of githubConfigs || []) {
      integrations.value.push({
        id: config.id,
        platform: 'github',
        envConfigId: config.id,
        lastSynced: config.last_synced_at,
        selected: true,
        syncing: false,
        status: null
      })
    }
  } catch (error) {
    console.error('Failed to fetch integrations:', error)
    $toast.error('Failed to load integrations')
  } finally {
    loading.value = false
  }
}

async function handleSync() {
  syncing.value = true
  const selected = integrations.value.filter(i => i.selected)

  let successCount = 0
  let partialCount = 0
  let errorCount = 0

  for (const integration of selected) {
    integration.syncing = true
    integration.status = null

    try {
      let data: any = null
      let invokeError: any = null

      if (integration.platform === 'github') {
        const response = await client.functions.invoke('github-sync', {
          body: { env_config_id: integration.envConfigId, trigger_type: 'manual' }
        })
        data = response.data
        invokeError = response.error
      } else {
        const response = await client.functions.invoke(`${integration.platform}-sync`, {
          body: { env_config_id: integration.envConfigId, trigger_type: 'manual' }
        })
        data = response.data
        invokeError = response.error
      }

      if (invokeError) {
        throw invokeError
      }

      if (data?.status === 'partial') {
        integration.status = 'partial'
        partialCount++
      } else if (data?.status === 'failed' || data?.success === false) {
        integration.status = 'error'
        errorCount++
      } else {
        integration.status = 'success'
        successCount++
      }
    } catch (e) {
      console.error(`Sync failed for ${integration.platform}:`, e)
      integration.status = 'error'
      errorCount++
    }

    integration.syncing = false
  }

  syncing.value = false

  // Show summary toast
  if (errorCount === 0 && partialCount === 0) {
    $toast.success(`Successfully synced ${successCount} integration${successCount === 1 ? '' : 's'}`)
  } else if (successCount === 0 && partialCount === 0) {
    $toast.error(`All ${errorCount} sync${errorCount === 1 ? '' : 's'} failed`)
  } else {
    $toast.warning(`${successCount} synced, ${partialCount} partial, ${errorCount} failed`)
  }

  emit('synced')
}

function close() {
  if (syncing.value) return
  // Reset state
  integrations.value.forEach(i => {
    i.status = null
    i.syncing = false
  })
  emit('close')
}
</script>
