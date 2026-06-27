<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="handleClose"
      />

      <!-- Modal -->
      <div class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF9900] text-white">
              <Icon name="simple-icons:amazonaws" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold">Configure AWS Sync</h2>
              <p class="text-sm text-muted-foreground">
                {{ connection?.name }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground"
            @click="handleClose"
          >
            <Icon name="lucide:x" class="h-5 w-5" />
          </button>
        </div>

        <!-- Region Info -->
        <div v-if="region" class="mb-6 rounded-md border border-border bg-muted/30 px-3 py-2">
          <p class="text-xs text-muted-foreground">
            <span class="font-medium">Region:</span> {{ region }}
            <span v-if="accountId" class="ml-3"><span class="font-medium">Account:</span> {{ accountId }}</span>
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-10">
          <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-primary" />
        </div>

        <!-- Form -->
        <form v-else @submit.prevent="handleSave" class="space-y-6">
          <!-- Environment Tabs -->
          <TabGroup :selectedIndex="selectedEnvIndex" @change="idx => selectedEnvIndex = idx">
            <TabList class="flex gap-1 border-b mb-6">
              <Tab v-for="env in environments" :key="env.id" as="template" v-slot="{ selected }">
                <button
                  type="button"
                  :class="[
                    'px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px',
                    selected
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  ]"
                >
                  <span class="flex items-center gap-2">
                    {{ env.name }}
                    <span :class="['h-2 w-2 rounded-full', envConfigs[env.id]?.enabled ? 'bg-success-500' : 'bg-gray-400']" />
                  </span>
                </button>
              </Tab>
            </TabList>
            <TabPanels>
              <TabPanel v-for="env in environments" :key="env.id" class="space-y-4">
                <!-- Enable toggle for this environment -->
                <label class="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/30">
                  <div>
                    <p class="font-medium">Enable sync for {{ env.name }}</p>
                    <p class="text-sm text-muted-foreground">
                      Sync variables from this environment to AWS Secrets Manager
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    v-model="envConfigs[env.id]!.enabled"
                    class="h-5 w-5 rounded border-input"
                  />
                </label>

                <!-- Prefix (when enabled) -->
                <div v-if="envConfigs[env.id]?.enabled" class="space-y-2">
                  <label class="block text-sm font-medium">Secret Name Prefix</label>
                  <PrefixInput
                    :model-value="envConfigs[env.id]!.prefix"
                    @update:model-value="(val) => envConfigs[env.id]!.prefix = val"
                  />
                  <p class="text-xs text-muted-foreground">
                    Optional prefix prepended to all secret names (e.g., "envmanager-" makes DATABASE_URL become envmanager-DATABASE_URL).
                  </p>
                </div>

                <!-- Service Scope -->
                <ServiceScopeSelect
                  v-if="envConfigs[env.id]?.enabled"
                  v-model="envConfigs[env.id]!.service_id"
                  :services="services"
                />
              </TabPanel>
            </TabPanels>
          </TabGroup>

          <!-- Sync Options -->
          <div v-if="hasAnyEnabled" class="space-y-4">
            <label class="block text-base font-medium">Sync Options</label>

            <div class="space-y-3">
              <label class="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/30">
                <div>
                  <p class="font-medium">Auto-sync</p>
                  <p class="text-sm text-muted-foreground">
                    Automatically sync when variables change
                  </p>
                </div>
                <input
                  type="checkbox"
                  v-model="syncOptions.autoSync"
                  class="h-5 w-5 rounded border-input"
                />
              </label>

              <label class="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/30">
                <div>
                  <p class="font-medium">Sync secrets</p>
                  <p class="text-sm text-muted-foreground">
                    Include secret variables (stored as AWS Secrets Manager secrets)
                  </p>
                </div>
                <input
                  type="checkbox"
                  v-model="syncOptions.syncSecrets"
                  class="h-5 w-5 rounded border-input"
                />
              </label>

              <label class="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/30">
                <div>
                  <p class="font-medium">Sync regular variables</p>
                  <p class="text-sm text-muted-foreground">
                    Include non-secret variables
                  </p>
                </div>
                <input
                  type="checkbox"
                  v-model="syncOptions.syncVariables"
                  class="h-5 w-5 rounded border-input"
                />
              </label>
            </div>

            <div class="rounded-md bg-blue-100 p-3 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              <Icon name="lucide:info" class="inline h-4 w-4 mr-1" />
              AWS Secrets Manager supports path-style names with / separators. Use a prefix like "envmanager/production/" to organize your secrets.
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              @click="handleClose"
              :disabled="saving"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              :loading="saving"
              :disabled="!canSave"
            >
              Save Configuration
            </Button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue'
import Button from '~/components/ui/Button.vue'
import PrefixInput from './PrefixInput.vue'
import ServiceScopeSelect from '~/components/services/ServiceScopeSelect.vue'
import { useEnvironmentIntegrationConfig } from '~/composables/useEnvironmentIntegrationConfig'
import { useServices } from '~/composables/useServices'
import type { PlatformConnection } from '~/types/integration.types'
import type { Database } from '~/types/database.types'

// =====================================================
// Types
// =====================================================

interface Environment {
  id: string
  name: string
}

interface EnvConfig {
  enabled: boolean
  prefix: string | null
  service_id: string | null
}

interface Props {
  open: boolean
  connection: PlatformConnection | null
  projectId: string
  projectIntegrationId: string
  environments: Environment[]
}

// =====================================================
// Props & Emits
// =====================================================

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  saved: []
}>()

const { getConfigsForIntegration, bulkUpsertConfigs } = useEnvironmentIntegrationConfig()
const { services, fetchServices } = useServices(computed(() => props.projectId))
const supabase = useSupabaseClient<Database>()
const { $toast } = useNuxtApp()

// =====================================================
// State
// =====================================================

const loading = ref(false)
const saving = ref(false)
const selectedEnvIndex = ref(0)

const envConfigs = ref<Record<string, EnvConfig>>({})
const initialConfigs = ref<Record<string, EnvConfig>>({})

const syncOptions = reactive({
  autoSync: false,
  syncSecrets: true,
  syncVariables: true
})
const initialSyncOptions = ref({ autoSync: false, syncSecrets: true, syncVariables: true })

// =====================================================
// Computed
// =====================================================

const region = computed(() => {
  const metadata = props.connection?.metadata as { region?: string } | null
  return metadata?.region || null
})

const accountId = computed(() => {
  const metadata = props.connection?.metadata as { account_id?: string } | null
  return metadata?.account_id || null
})

const hasAnyEnabled = computed(() => {
  return Object.values(envConfigs.value).some(config => config.enabled)
})

const hasChanges = computed(() => {
  return JSON.stringify(envConfigs.value) !== JSON.stringify(initialConfigs.value) ||
    syncOptions.autoSync !== initialSyncOptions.value.autoSync ||
    syncOptions.syncSecrets !== initialSyncOptions.value.syncSecrets ||
    syncOptions.syncVariables !== initialSyncOptions.value.syncVariables
})

const canSave = computed(() => {
  return hasAnyEnabled.value &&
         (syncOptions.syncSecrets || syncOptions.syncVariables)
})

// =====================================================
// Methods
// =====================================================

function handleClose() {
  if (!saving.value) {
    if (hasChanges.value) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to close?')
      if (!confirm) return
    }
    emit('close')
  }
}

async function handleSave() {
  if (!props.connection || !props.projectId || !props.projectIntegrationId) return

  saving.value = true

  try {
    const configsList = []

    for (const env of props.environments) {
      const envConfig = envConfigs.value[env.id]

      if (envConfig?.enabled) {
        const targetConfig = {
          auto_sync: syncOptions.autoSync,
          sync_secrets: syncOptions.syncSecrets,
          sync_variables: syncOptions.syncVariables
        }

        configsList.push({
          environment_id: env.id,
          target_config: targetConfig,
          prefix: envConfig.prefix,
          enabled: true,
          service_id: envConfig.service_id
        })
      } else {
        configsList.push({
          environment_id: env.id,
          target_config: {},
          prefix: null,
          enabled: false,
          service_id: envConfig?.service_id ?? null
        })
      }
    }

    const { error } = await bulkUpsertConfigs(props.projectIntegrationId, configsList)

    if (error) {
      throw new Error(error)
    }

    // Update platform_sync_configs.target so IntegrationCard knows we're configured
    const configuredEnvs = configsList.filter(c => c.enabled).map(c => {
      const env = props.environments.find(e => e.id === c.environment_id)
      return env?.name || 'Unknown'
    })

    const { error: updateError } = await supabase
      .from('platform_sync_configs')
      .update({
        target: {
          type: 'per_environment',
          configured_environments: configuredEnvs,
          auto_sync: syncOptions.autoSync,
          sync_secrets: syncOptions.syncSecrets,
          sync_variables: syncOptions.syncVariables
        },
        auto_sync: syncOptions.autoSync,
        sync_secrets: syncOptions.syncSecrets,
        sync_variables: syncOptions.syncVariables
      })
      .eq('connection_id', props.projectIntegrationId)
      .eq('project_id', props.projectId)

    if (updateError) throw updateError

    $toast.success('AWS sync configuration saved')
    emit('saved')
    emit('close')

  } catch (err) {
    console.error('Failed to save AWS configuration:', err)
    $toast.error('Failed to save configuration. Please try again.')
  } finally {
    saving.value = false
  }
}

// =====================================================
// Watchers
// =====================================================

watch(() => props.open, async (isOpen) => {
  if (isOpen && props.connection) {
    loading.value = true

    // Initialize envConfigs for all environments
    const newConfigs: Record<string, EnvConfig> = {}
    for (const env of props.environments) {
      newConfigs[env.id] = {
        enabled: false,
        prefix: null,
        service_id: null
      }
    }

    // Load existing configs from database
    const { data: existingConfigs } = await getConfigsForIntegration(props.projectIntegrationId)

    if (existingConfigs && existingConfigs.length > 0) {
      for (const config of existingConfigs) {
        if (newConfigs[config.environment_id]) {
          newConfigs[config.environment_id] = {
            enabled: config.enabled ?? false,
            prefix: config.prefix,
            service_id: config.service_id ?? null
          }
        }
      }

      // Load sync options from first config
      const firstConfig = existingConfigs[0]?.target_config as any
      if (firstConfig) {
        syncOptions.autoSync = firstConfig.auto_sync ?? false
        syncOptions.syncSecrets = firstConfig.sync_secrets ?? true
        syncOptions.syncVariables = firstConfig.sync_variables ?? true
      }
    }

    envConfigs.value = newConfigs
    initialConfigs.value = JSON.parse(JSON.stringify(newConfigs))
    initialSyncOptions.value = { autoSync: syncOptions.autoSync, syncSecrets: syncOptions.syncSecrets, syncVariables: syncOptions.syncVariables }

    // Load services for service scope selector
    await fetchServices()

    loading.value = false
  }
})
</script>
