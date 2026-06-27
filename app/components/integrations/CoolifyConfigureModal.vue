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
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2496ED] text-white">
              <Icon name="lucide:server" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold">Configure Coolify Sync</h2>
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

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-10">
          <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-primary" />
        </div>

        <!-- Form with Environment Tabs -->
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
                    <span :class="['h-2 w-2 rounded-full', isEnvConfigured(env.id) ? 'bg-success-500' : 'bg-gray-400']" />
                  </span>
                </button>
              </Tab>
            </TabList>

            <TabPanels>
              <TabPanel v-for="env in environments" :key="env.id" class="space-y-6">
                <!-- Target Selection -->
                <CoolifyTargetSelect
                  v-model="envConfigs[env.id]!.target"
                  :connection-id="connection?.id || ''"
                />

                <!-- Note: With per-env tabs, CoolifyEnvironmentMapping is not needed
                     Each tab represents one environment already -->

                <!-- Service Scope -->
                <ServiceScopeSelect
                  v-if="envConfigs[env.id]!.target"
                  v-model="envConfigs[env.id]!.service_id"
                  :services="services"
                />

                <!-- Advanced Options -->
                <div v-if="envConfigs[env.id]!.target" class="border-t mt-4 pt-4">
                  <button
                    type="button"
                    @click="showAdvanced[env.id] = !showAdvanced[env.id]"
                    class="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    <span>Advanced options</span>
                    <Icon
                      name="lucide:chevron-down"
                      class="h-4 w-4 transition-transform"
                      :class="showAdvanced[env.id] && 'rotate-180'"
                    />
                  </button>
                  <div v-if="showAdvanced[env.id]" class="mt-4 space-y-2">
                    <label class="block text-sm font-medium">Variable Prefix (optional)</label>
                    <PrefixInput
                      :model-value="envConfigs[env.id]!.prefix"
                      @update:model-value="(val) => updatePrefix(env.id, val)"
                    />
                  </div>
                </div>
              </TabPanel>
            </TabPanels>
          </TabGroup>

          <!-- Sync Options (Global across all environments) -->
          <div v-if="hasAnyConfiguredEnv" class="space-y-4">
            <label class="block text-base font-medium">Sync Options</label>

            <div class="space-y-3">
              <!-- Include as build variables checkbox (Coolify-specific) -->
              <label class="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/30">
                <div>
                  <p class="font-medium">Include as build variables</p>
                  <p class="text-sm text-muted-foreground">
                    Variables will be available during Docker build
                  </p>
                </div>
                <input
                  type="checkbox"
                  v-model="syncOptions.includeBuildVars"
                  class="h-5 w-5 rounded border-input"
                />
              </label>

              <!-- Auto-sync toggle -->
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

              <!-- Sync secrets toggle -->
              <label class="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/30">
                <div>
                  <p class="font-medium">Sync secrets</p>
                  <p class="text-sm text-muted-foreground">
                    Include secret variables (visible in Coolify dashboard)
                  </p>
                </div>
                <input
                  type="checkbox"
                  v-model="syncOptions.syncSecrets"
                  class="h-5 w-5 rounded border-input"
                />
              </label>

              <!-- Sync variables toggle -->
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

            <!-- Note about deployment -->
            <div class="rounded-md bg-yellow-100 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              <Icon name="lucide:info" class="inline h-4 w-4 mr-1" />
              Note: Changes may require redeploying your Coolify application to take effect.
            </div>
          </div>

          <!-- Warning: No configurations -->
          <div
            v-if="!hasAnyConfiguredEnv"
            class="rounded-md bg-yellow-100 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
          >
            <Icon name="lucide:alert-triangle" class="inline h-4 w-4 mr-1" />
            No environments configured. Configure at least one environment to sync.
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
import CoolifyTargetSelect from './CoolifyTargetSelect.vue'
import CoolifyEnvironmentMapping from './CoolifyEnvironmentMapping.vue'
import PrefixInput from './PrefixInput.vue'
import ServiceScopeSelect from '~/components/services/ServiceScopeSelect.vue'
import { useCoolifyIntegration } from '~/composables/useCoolifyIntegration'
import { useEnvironmentIntegrationConfig } from '~/composables/useEnvironmentIntegrationConfig'
import { useServices } from '~/composables/useServices'
import type { CoolifySyncTarget } from '~/composables/useCoolifyIntegration'
import type { PlatformConnection, SyncConfig } from '~/types/integration.types'
import type { Database } from '~/types/database.types'

// Type for selected resource from CoolifyTargetSelect
type ResourceType = 'application' | 'database' | 'service'

interface SelectedResource {
  uuid: string
  name: string
  fqdn?: string | null
  type?: string
  resource_type: ResourceType
}

// =====================================================
// Types
// =====================================================

interface Environment {
  id: string
  name: string
}

interface EnvConfig {
  target: SelectedResource | null
  selectedEnvironments: string[]
  prefix: string | null
  service_id: string | null
}

interface Props {
  open: boolean
  connection: PlatformConnection | null
  projectId: string  // EnvManager project ID
  environments: Environment[]
  existingConfig?: SyncConfig | null
}

// =====================================================
// Props & Emits
// =====================================================

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  saved: []
}>()

const { configureSyncTarget } = useCoolifyIntegration()
const { getConfigsForIntegration, bulkUpsertConfigs } = useEnvironmentIntegrationConfig()
const { services, fetchServices } = useServices(computed(() => props.projectId))
const { $toast } = useNuxtApp()
const client = useSupabaseClient<Database>()

// =====================================================
// State
// =====================================================

const loading = ref(false)
const saving = ref(false)

// Per-environment configuration state
const envConfigs = ref<Record<string, EnvConfig>>({})
const initialConfigs = ref<Record<string, EnvConfig>>({})
const selectedEnvIndex = ref(0)
const showAdvanced = ref<Record<string, boolean>>({})
const projectIntegrationId = ref<string | null>(null)

const syncOptions = reactive({
  includeBuildVars: false,
  autoSync: false,
  syncSecrets: true,
  syncVariables: true
})

// =====================================================
// Computed
// =====================================================

function isEnvConfigured(envId: string): boolean {
  return envConfigs.value[envId]?.target !== null &&
         envConfigs.value[envId]?.target !== undefined
}

const hasAnyConfiguredEnv = computed(() => {
  return Object.values(envConfigs.value).some(config => config.target !== null)
})

const hasChanges = computed(() => {
  return JSON.stringify(envConfigs.value) !== JSON.stringify(initialConfigs.value)
})

const canSave = computed(() => {
  return hasAnyConfiguredEnv.value &&
         (syncOptions.syncSecrets || syncOptions.syncVariables)
})

// =====================================================
// Methods
// =====================================================

function handleClose() {
  if (saving.value) return

  if (hasChanges.value) {
    const confirmClose = confirm('You have unsaved changes. Are you sure you want to close?')
    if (!confirmClose) return
  }

  emit('close')
}

function updatePrefix(envId: string, value: string | null) {
  if (envConfigs.value[envId]) {
    envConfigs.value[envId].prefix = value
  }
}

async function handleSave() {
  if (!props.connection || !props.projectId || !projectIntegrationId.value) return

  saving.value = true

  try {
    const configsToUpsert = []

    // Build config for each configured environment
    // Note: With per-env tabs, each environment maps to itself (no longer multi-mapping)
    for (const env of props.environments) {
      const envConfig = envConfigs.value[env.id]
      if (!envConfig || !envConfig.target) continue

      // Build target_config including Coolify-specific fields
      const targetConfig = {
        resource_uuid: envConfig.target.uuid,
        resource_name: envConfig.target.name,
        resource_type: envConfig.target.resource_type,
        include_build_vars: syncOptions.includeBuildVars,
        // Each environment syncs to itself (no multi-mapping with tabs)
        environment_mapping: [{ envmanager_env: env.id }]
      }

      configsToUpsert.push({
        environment_id: env.id,
        target_config: targetConfig,
        prefix: envConfig.prefix,
        enabled: true,
        service_id: envConfig.service_id
      })
    }

    if (configsToUpsert.length === 0) {
      $toast.error('No environments configured')
      saving.value = false
      return
    }

    // Bulk upsert all environment configs
    const { error } = await bulkUpsertConfigs(projectIntegrationId.value, configsToUpsert)
    if (error) {
      $toast.error('Failed to save configuration')
      saving.value = false
      return
    }

    // Update platform_sync_configs.target so IntegrationCard knows we're configured
    const configuredEnvs = configsToUpsert.map(c => {
      const env = props.environments.find(e => e.id === c.environment_id)
      return env?.name || 'Unknown'
    })

    await client
      .from('platform_sync_configs')
      .upsert({
        connection_id: props.connection.id,
        project_id: props.projectId,
        target: {
          type: 'per_environment',
          configured_environments: configuredEnvs
        } as any,
        auto_sync: syncOptions.autoSync,
        sync_secrets: syncOptions.syncSecrets,
        sync_variables: syncOptions.syncVariables,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'connection_id,project_id'
      })

    $toast.success('Coolify sync configuration saved')
    emit('saved')
    emit('close')

  } catch (err) {
    console.error('[CoolifyConfigureModal] Error:', err)
    $toast.error('Failed to save configuration')
  } finally {
    saving.value = false
  }
}

// =====================================================
// Watchers
// =====================================================

watch(() => props.open, async (isOpen) => {
  if (isOpen && props.connection && props.projectId) {
    loading.value = true

    try {
      // Initialize envConfigs for all environments
      const configs: Record<string, EnvConfig> = {}
      for (const env of props.environments) {
        configs[env.id] = {
          target: null,
          selectedEnvironments: [],
          prefix: null,
          service_id: null
        }
        showAdvanced.value[env.id] = false
      }

      // props.connection.id IS the platform_integrations.id
      projectIntegrationId.value = props.connection.id

      // Load existing per-environment configs
      const { data: existingConfigs } = await getConfigsForIntegration(props.connection.id)

      if (existingConfigs) {
        for (const config of existingConfigs) {
          const targetConfig = config.target_config as any
          if (targetConfig && configs[config.environment_id]) {
            // Support both old (application_uuid) and new (resource_uuid) format
            configs[config.environment_id] = {
              target: {
                uuid: targetConfig.resource_uuid || targetConfig.application_uuid || '',
                name: targetConfig.resource_name || targetConfig.application_name || '',
                resource_type: targetConfig.resource_type || 'application'
              },
              selectedEnvironments: targetConfig.environment_mapping?.map((m: any) => m.envmanager_env) || [],
              prefix: config.prefix,
              service_id: config.service_id ?? null
            }
          }
        }
      }

      envConfigs.value = configs
      initialConfigs.value = JSON.parse(JSON.stringify(configs))

      // Load services for service scope selector
      await fetchServices()

      // Load sync options from legacy config or existing
      // Cast through unknown to handle both old and new format
      const existing = props.existingConfig?.target as unknown as (CoolifySyncTarget & {
        application_uuid?: string
        application_name?: string
      }) | undefined

      syncOptions.includeBuildVars = existing?.include_build_vars ?? false
      syncOptions.autoSync = props.existingConfig?.auto_sync ?? false
      syncOptions.syncSecrets = props.existingConfig?.sync_secrets ?? true
      syncOptions.syncVariables = props.existingConfig?.sync_variables ?? true

    } finally {
      loading.value = false
    }
  }
})
</script>
