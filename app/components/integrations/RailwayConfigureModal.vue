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
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0B0D0E] text-white">
              <Icon name="lucide:git-branch" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold">Configure Railway Sync</h2>
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
                    <span :class="['h-2 w-2 rounded-full', isEnvConfigured(env.id) ? 'bg-success-500' : 'bg-gray-400']" />
                  </span>
                </button>
              </Tab>
            </TabList>
            <TabPanels>
              <TabPanel v-for="env in environments" :key="env.id" class="space-y-6">
                <!-- Target Selection -->
                <RailwayTargetSelect
                  v-model="envConfigs[env.id]!.target"
                  :connection-id="connection?.id || ''"
                />

                <!-- Environment Mapping (only if target selected with environments) -->
                <RailwayEnvironmentMapping
                  v-if="envConfigs[env.id]!.target && envConfigs[env.id]!.target!.environments.length > 0"
                  v-model="envConfigs[env.id]!.environmentMapping"
                  :envmanager-environments="[env]"
                  :railway-environments="envConfigs[env.id]!.target!.environments"
                />

                <!-- Service Scope -->
                <ServiceScopeSelect
                  v-if="envConfigs[env.id]!.target"
                  v-model="envConfigs[env.id]!.service_id"
                  :services="services"
                />

                <!-- Advanced Options (collapsible) -->
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
                  <div v-if="showAdvanced[env.id]" class="mt-4">
                    <label class="block text-sm font-medium mb-2">Variable Prefix</label>
                    <PrefixInput
                      :model-value="envConfigs[env.id]!.prefix"
                      @update:model-value="(val) => updatePrefix(env.id, val)"
                    />
                    <p class="text-xs text-muted-foreground mt-2">
                      Optional prefix to add to all variable names synced to this environment.
                    </p>
                  </div>
                </div>
              </TabPanel>
            </TabPanels>
          </TabGroup>

          <!-- Sync Options -->
          <div v-if="hasAnyTarget" class="space-y-4">
            <label class="block text-base font-medium">Sync Options</label>

            <div class="space-y-3">
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
                    Include secret variables (visible in Railway dashboard)
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

            <!-- Note about secrets visibility per RESEARCH.md -->
            <div class="rounded-md bg-yellow-100 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              <Icon name="lucide:info" class="inline h-4 w-4 mr-1" />
              Note: Variables synced to Railway will be visible in the Railway dashboard.
              Railway's sealed variables feature is only available through their UI.
            </div>
          </div>

          <!-- Warning: No mappings -->
          <div
            v-if="hasAnyTarget && !hasAnyMapping"
            class="rounded-md bg-yellow-100 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
          >
            <Icon name="lucide:alert-triangle" class="inline h-4 w-4 mr-1" />
            No environments mapped. Select at least one Railway environment for each environment you want to sync.
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
import RailwayTargetSelect from './RailwayTargetSelect.vue'
import RailwayEnvironmentMapping from './RailwayEnvironmentMapping.vue'
import PrefixInput from './PrefixInput.vue'
import ServiceScopeSelect from '~/components/services/ServiceScopeSelect.vue'
import { useRailwayIntegration } from '~/composables/useRailwayIntegration'
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

interface SelectedTarget {
  projectId: string
  projectName: string
  workspaceId: string | null
  serviceId: string | null
  serviceName: string | null
  environments: Array<{ id: string; name: string }>
}

interface EnvironmentMappingItem {
  envmanager_env: string
  railway_env_id: string
  railway_env_name: string
}

interface EnvConfig {
  target: SelectedTarget | null
  environmentMapping: EnvironmentMappingItem[]
  prefix: string | null
  service_id: string | null
}

interface Props {
  open: boolean
  connection: PlatformConnection | null
  projectId: string  // EnvManager project ID
  projectIntegrationId: string  // platform_integrations.id (the org-level connection ID)
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

const { } = useRailwayIntegration()
const { getConfigsForIntegration, bulkUpsertConfigs } = useEnvironmentIntegrationConfig()
const { services, fetchServices } = useServices(computed(() => props.projectId))
const supabase = useSupabaseClient<Database>()

// =====================================================
// State
// =====================================================

const loading = ref(false)
const saving = ref(false)
const selectedEnvIndex = ref(0)

const envConfigs = ref<Record<string, EnvConfig>>({})
const initialConfigs = ref<Record<string, EnvConfig>>({})
const showAdvanced = ref<Record<string, boolean>>({})

const syncOptions = reactive({
  autoSync: false,
  syncSecrets: true,
  syncVariables: true
})

// =====================================================
// Computed
// =====================================================

const isEnvConfigured = (envId: string) => {
  return envConfigs.value[envId]?.target !== null
}

const hasAnyTarget = computed(() => {
  return Object.values(envConfigs.value).some(config => config.target !== null)
})

const hasAnyMapping = computed(() => {
  return Object.values(envConfigs.value).some(config =>
    config.environmentMapping.length > 0
  )
})

const hasChanges = computed(() => {
  return JSON.stringify(envConfigs.value) !== JSON.stringify(initialConfigs.value)
})

const canSave = computed(() => {
  return hasAnyTarget.value &&
         hasAnyMapping.value &&
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

function updatePrefix(envId: string, value: string | null) {
  if (envConfigs.value[envId]) {
    envConfigs.value[envId].prefix = value
  }
}

async function handleSave() {
  if (!props.connection || !props.projectId || !props.projectIntegrationId) return

  saving.value = true

  try {
    // Build configs for environments with targets
    const configsList = []

    for (const env of props.environments) {
      const envConfig = envConfigs.value[env.id]

      if (envConfig?.target) {
        // Build target_config including Railway-specific fields AND prefix
        const targetConfig = {
          project_id: envConfig.target.projectId,
          project_name: envConfig.target.projectName,
          workspace_id: envConfig.target.workspaceId || '',
          service_id: envConfig.target.serviceId,
          service_name: envConfig.target.serviceName,
          environment_mapping: envConfig.environmentMapping,
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
      }
    }

    // Bulk upsert all environment configs
    const { error } = await bulkUpsertConfigs(props.projectIntegrationId, configsList)

    if (error) {
      throw new Error(error)
    }

    // Also update platform_sync_configs.target so IntegrationCard knows we're configured
    const configuredEnvs = configsList.map(c => {
      const env = props.environments.find(e => e.id === c.environment_id)
      return env?.name || 'Unknown'
    })

    await supabase
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

    emit('saved')
    emit('close')

  } catch (err) {
    console.error('Failed to save Railway configuration:', err)
    alert('Failed to save configuration. Please try again.')
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
        target: null,
        environmentMapping: [],
        prefix: null,
        service_id: null
      }
      showAdvanced.value[env.id] = false
    }

    // Load existing configs from database
    const { data: existingConfigs } = await getConfigsForIntegration(props.projectIntegrationId)

    if (existingConfigs && existingConfigs.length > 0) {
      // Populate envConfigs from existing data
      for (const config of existingConfigs) {
        const targetConfig = config.target_config as any

        if (newConfigs[config.environment_id] && targetConfig?.project_id) {
          newConfigs[config.environment_id] = {
            target: {
              projectId: targetConfig.project_id,
              projectName: targetConfig.project_name,
              workspaceId: targetConfig.workspace_id || null,
              serviceId: targetConfig.service_id,
              serviceName: targetConfig.service_name,
              // We'll need the target selector to reload environments
              environments: []
            },
            environmentMapping: targetConfig.environment_mapping || [],
            prefix: config.prefix,
            service_id: config.service_id ?? null
          }
        }
      }

      // Load sync options from first config (they're shared)
      const firstConfig = existingConfigs[0]?.target_config as any
      if (firstConfig) {
        syncOptions.autoSync = firstConfig.auto_sync ?? false
        syncOptions.syncSecrets = firstConfig.sync_secrets ?? true
        syncOptions.syncVariables = firstConfig.sync_variables ?? true
      }
    }

    envConfigs.value = newConfigs
    // Deep clone for change detection
    initialConfigs.value = JSON.parse(JSON.stringify(newConfigs))

    // Load services for service scope selector
    await fetchServices()

    loading.value = false
  }
})
</script>
