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
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#24292f] text-white">
              <Icon name="lucide:github" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold">Configure GitHub Sync</h2>
              <p class="text-sm text-muted-foreground">
                {{ installation?.account_login }}
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

        <div v-else>
          <!-- Variable Selection View -->
          <div v-if="isSelectingVariables" class="space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-semibold">Select variables</h3>
                <p class="text-sm text-muted-foreground">
                  {{ activeEnvironment?.name }}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" @click="closeVariableSelector">
                Done
              </Button>
            </div>

            <div class="space-y-3">
              <Input
                v-model="variableSearch"
                placeholder="Search variables"
              />
              <div class="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {{ getSelectedCount(variableSelectorEnvId || '') }} of {{ getTotalCount(variableSelectorEnvId || '') }} selected
                </span>
                <div class="flex items-center gap-3">
                  <button type="button" class="text-primary hover:underline" @click="selectAllActiveVariables">
                    Select all
                  </button>
                  <button type="button" class="text-muted-foreground hover:text-foreground" @click="clearActiveVariables">
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div class="rounded-md border max-h-72 overflow-y-auto">
              <div v-if="variablesLoading[variableSelectorEnvId || '']" class="flex justify-center py-6">
                <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
              <div v-else-if="activeVariables.length === 0" class="p-4 text-sm text-muted-foreground text-center">
                No variables found for this environment.
              </div>
              <div v-else class="divide-y">
                <label
                  v-for="variable in activeVariables"
                  :key="variable.id"
                  class="flex items-center justify-between gap-4 p-3 cursor-pointer hover:bg-muted/30"
                >
                  <div class="flex items-center gap-3">
                    <input
                      type="checkbox"
                      v-model="variable.selected"
                      class="h-4 w-4 rounded border-input"
                    />
                    <span class="font-mono text-sm">{{ variable.key }}</span>
                  </div>
                  <span
                    v-if="variable.is_secret"
                    class="text-xs text-amber-600 dark:text-amber-400"
                  >
                    Secret
                  </span>
                </label>
              </div>
            </div>

            <p class="text-xs text-muted-foreground">
              Changes apply when you save the GitHub configuration.
            </p>
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
                <GitHubTargetSelect
                  v-model="envConfigs[env.id]!.target"
                  :repositories="repositories"
                  :loading-repos="loadingRepos"
                />

                <!-- Variable Selection (when sync mode is selected) -->
                <div
                  v-if="envConfigs[env.id]!.target && syncOptions.syncMode === 'selected'"
                  class="rounded-lg border p-4"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium">Selected variables</p>
                      <p class="text-sm text-muted-foreground">
                        Choose which variables sync from {{ env.name }}.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" @click="openVariableSelector(env.id)">
                      Select variables
                    </Button>
                  </div>
                  <p class="text-xs text-muted-foreground mt-2">
                    {{ getSelectedCount(env.id) }} of {{ getTotalCount(env.id) }} selected
                  </p>
                </div>

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
                      :modelValue="envConfigs[env.id]!.prefix"
                      @update:modelValue="(val) => envConfigs[env.id]!.prefix = val"
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
              <!-- Sync mode -->
              <div class="rounded-lg border p-4 space-y-2">
                <div>
                  <p class="font-medium">Sync scope</p>
                  <p class="text-sm text-muted-foreground">
                    Choose whether to sync all variables or only selected ones.
                  </p>
                </div>
                <div class="space-y-2">
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      value="all"
                      v-model="syncOptions.syncMode"
                      class="h-4 w-4 rounded-full border-input"
                    />
                    <span>All variables</span>
                  </label>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      value="selected"
                      v-model="syncOptions.syncMode"
                      class="h-4 w-4 rounded-full border-input"
                    />
                    <span>Selected variables</span>
                  </label>
                </div>
              </div>

              <!-- Variable storage mode -->
              <div class="rounded-lg border p-4 space-y-2">
                <div>
                  <p class="font-medium">GitHub storage mode</p>
                  <p class="text-sm text-muted-foreground">
                    Choose whether regular variables stay as GitHub variables or are stored as GitHub secrets.
                  </p>
                </div>
                <div class="space-y-2">
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      value="preserve_types"
                      v-model="syncOptions.variableStorageMode"
                      class="h-4 w-4 rounded-full border-input"
                    />
                    <span>Preserve variable types</span>
                  </label>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      value="all_as_secrets"
                      v-model="syncOptions.variableStorageMode"
                      class="h-4 w-4 rounded-full border-input"
                    />
                    <span>Store everything as GitHub secrets</span>
                  </label>
                </div>
              </div>

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
                    Include secret variables (encrypted on GitHub)
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
          </div>

          <!-- Warning: No targets -->
          <div
            v-if="!hasAnyTarget"
            class="rounded-md bg-yellow-100 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
          >
            <Icon name="lucide:alert-triangle" class="inline h-4 w-4 mr-1" />
            Configure at least one environment target to enable syncing.
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
  </div>
  </Teleport>
</template>

<script setup lang="ts">
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue'
import Button from '~/components/ui/Button.vue'
import Input from '~/components/ui/Input.vue'
import GitHubTargetSelect from './GitHubTargetSelect.vue'
import PrefixInput from './PrefixInput.vue'
import type { GitHubRepository } from '~/composables/useGitHubIntegration'
import { useGitHubEnvironmentConfig, type GitHubTargetConfig } from '~/composables/useGitHubEnvironmentConfig'
import type { Database } from '~/types/database.types'

type GitHubInstallation = Database['public']['Tables']['github_installations']['Row']
type GitHubProjectSyncConfig = Database['public']['Tables']['github_project_sync_configs']['Row']

interface Environment {
  id: string
  name: string
}

interface EnvConfig {
  target: GitHubTargetConfig | null
  prefix: string | null
}

function isGitHubTargetConfig(value: unknown): value is GitHubTargetConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return candidate.sync_level === 'repository' ||
    candidate.sync_level === 'environment' ||
    candidate.sync_level === 'organization'
}

interface EnvVariable {
  id: string
  key: string
  is_secret: boolean
  sync_to_github: boolean
  selected: boolean
}

interface Props {
  open: boolean
  installation: GitHubInstallation | null
  projectSyncConfig: GitHubProjectSyncConfig | null
  projectId: string
  environments: Environment[]
  repositories: GitHubRepository[]
  loadingRepos?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loadingRepos: false
})
const emit = defineEmits<{
  close: []
  saved: []
}>()

const { getConfigsForProjectSync, bulkUpsertConfigs } = useGitHubEnvironmentConfig()
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
const showAdvanced = ref<Record<string, boolean>>({})

const syncOptions = reactive({
  autoSync: false,
  syncSecrets: true,
  syncVariables: true,
  syncMode: 'all' as 'all' | 'selected',
  variableStorageMode: 'preserve_types' as 'preserve_types' | 'all_as_secrets'
})
const initialSyncOptions = ref({
  autoSync: false,
  syncSecrets: true,
  syncVariables: true,
  syncMode: 'all' as 'all' | 'selected',
  variableStorageMode: 'preserve_types' as 'preserve_types' | 'all_as_secrets'
})

const variableSelectorEnvId = ref<string | null>(null)
const variableSearch = ref('')
const variablesByEnv = ref<Record<string, EnvVariable[]>>({})
const variablesLoading = ref<Record<string, boolean>>({})
const initialVariableSelections = ref<Record<string, string[]>>({})

// =====================================================
// Computed
// =====================================================

const isEnvConfigured = (envId: string) => {
  return envConfigs.value[envId]?.target !== null
}

const hasAnyTarget = computed(() => {
  return Object.values(envConfigs.value).some(config => config.target !== null)
})

const isSelectingVariables = computed(() => variableSelectorEnvId.value !== null)

const activeEnvironment = computed(() => {
  if (!variableSelectorEnvId.value) return null
  return props.environments.find(env => env.id === variableSelectorEnvId.value) || null
})

const activeVariables = computed(() => {
  if (!variableSelectorEnvId.value) return []
  const variables = variablesByEnv.value[variableSelectorEnvId.value] || []
  const search = variableSearch.value.trim().toLowerCase()
  if (!search) return variables
  return variables.filter(variable => variable.key.toLowerCase().includes(search))
})

const hasSelectionChanges = computed(() => {
  if (syncOptions.syncMode !== 'selected') return false
  for (const [envId, variables] of Object.entries(variablesByEnv.value)) {
    const initial = initialVariableSelections.value[envId] || []
    const current = variables
      .filter(variable => variable.selected)
      .map(variable => variable.id)
      .sort()
    if (JSON.stringify(current) !== JSON.stringify(initial)) {
      return true
    }
  }
  return false
})

const hasChanges = computed(() => {
  const configsChanged = JSON.stringify(envConfigs.value) !== JSON.stringify(initialConfigs.value)
  const optionsChanged = syncOptions.autoSync !== initialSyncOptions.value.autoSync ||
    syncOptions.syncSecrets !== initialSyncOptions.value.syncSecrets ||
    syncOptions.syncVariables !== initialSyncOptions.value.syncVariables ||
    syncOptions.syncMode !== initialSyncOptions.value.syncMode ||
    syncOptions.variableStorageMode !== initialSyncOptions.value.variableStorageMode
  return configsChanged || optionsChanged || hasSelectionChanges.value
})

const canSave = computed(() => {
  return hasAnyTarget.value && (syncOptions.syncSecrets || syncOptions.syncVariables)
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

async function loadVariablesForEnv(envId: string) {
  if (variablesByEnv.value[envId]) return

  variablesLoading.value[envId] = true

  try {
    const { data, error: fetchError } = await supabase
      .from('variables')
      .select('id, key, is_secret, sync_to_github')
      .eq('environment_id', envId)
      .order('key', { ascending: true })

    if (fetchError) throw fetchError

    const variables = (data || []).map(variable => ({
      ...variable,
      selected: variable.sync_to_github
    })) as EnvVariable[]

    variablesByEnv.value[envId] = variables
    initialVariableSelections.value[envId] = variables
      .filter(variable => variable.selected)
      .map(variable => variable.id)
      .sort()
  } catch (err) {
    console.error('[GitHubConfigureModal] Failed to load variables:', err)
    $toast.error('Failed to load variables')
  } finally {
    variablesLoading.value[envId] = false
  }
}

async function preloadSelectedModeVariables() {
  if (syncOptions.syncMode !== 'selected') return

  const envIdsWithTarget = Object.keys(envConfigs.value).filter(envId => envConfigs.value[envId]?.target)

  if (envIdsWithTarget.length === 0) return

  await Promise.all(envIdsWithTarget.map(envId => loadVariablesForEnv(envId)))
}

async function openVariableSelector(envId: string) {
  variableSearch.value = ''
  await loadVariablesForEnv(envId)
  variableSelectorEnvId.value = envId
}

function closeVariableSelector() {
  variableSelectorEnvId.value = null
  variableSearch.value = ''
}

function getSelectedCount(envId: string) {
  return (variablesByEnv.value[envId] || []).filter(variable => variable.selected).length
}

function getTotalCount(envId: string) {
  return (variablesByEnv.value[envId] || []).length
}

function selectAllActiveVariables() {
  if (!variableSelectorEnvId.value) return
  const envId = variableSelectorEnvId.value
  const variables = variablesByEnv.value[envId] || []
  variables.forEach(variable => { variable.selected = true })
}

function clearActiveVariables() {
  if (!variableSelectorEnvId.value) return
  const envId = variableSelectorEnvId.value
  const variables = variablesByEnv.value[envId] || []
  variables.forEach(variable => { variable.selected = false })
}


async function handleSave() {
  if (!props.projectSyncConfig) return

  saving.value = true

  try {
    // Build configs for environments with targets
    const configsList = []

    for (const env of props.environments) {
      const envConfig = envConfigs.value[env.id]

      if (envConfig?.target) {
        configsList.push({
          environment_id: env.id,
          target_config: {
            ...envConfig.target,
            auto_sync: syncOptions.autoSync,
            sync_secrets: syncOptions.syncSecrets,
            sync_variables: syncOptions.syncVariables
          },
          prefix: envConfig.prefix,
          enabled: true
        })
      }
    }

    // Bulk upsert all environment configs
    const { error } = await bulkUpsertConfigs(props.projectSyncConfig.id, configsList)

    if (error) {
      throw new Error(error)
    }

    // Update project sync config with sync options
    const { error: syncConfigError } = await supabase
      .from('github_project_sync_configs')
      .update({
        auto_sync: syncOptions.autoSync,
        sync_secrets: syncOptions.syncSecrets,
        sync_variables: syncOptions.syncVariables,
        sync_mode: syncOptions.syncMode,
        variable_storage_mode: syncOptions.variableStorageMode
      })
      .eq('id', props.projectSyncConfig.id)

    if (syncConfigError) {
      throw syncConfigError
    }

    if (syncOptions.syncMode === 'selected') {
      for (const env of props.environments) {
        const envConfig = envConfigs.value[env.id]
        if (!envConfig?.target) continue

        await loadVariablesForEnv(env.id)

        const envVariables = variablesByEnv.value[env.id] || []
        const selectedIds = envVariables
          .filter(variable => variable.selected)
          .map(variable => variable.id)

        const { error: resetError } = await supabase
          .from('variables')
          .update({ sync_to_github: false })
          .eq('environment_id', env.id)

        if (resetError) throw resetError

        if (selectedIds.length > 0) {
          const { error: selectError } = await supabase
            .from('variables')
            .update({ sync_to_github: true })
            .in('id', selectedIds)
            .eq('environment_id', env.id)

          if (selectError) throw selectError
        }
      }
    }

    $toast.success('GitHub configuration saved')
    emit('saved')
    emit('close')

  } catch (err) {
    console.error('Failed to save GitHub configuration:', err)
    $toast.error('Failed to save configuration')
  } finally {
    saving.value = false
  }
}

// =====================================================
// Lifecycle
// =====================================================

watch(() => props.open, async (isOpen) => {
  if (isOpen && props.installation && props.projectSyncConfig) {
    loading.value = true

    variablesByEnv.value = {}
    variablesLoading.value = {}
    initialVariableSelections.value = {}
    variableSelectorEnvId.value = null
    variableSearch.value = ''

    // Initialize envConfigs for all environments
    const newConfigs: Record<string, EnvConfig> = {}
    for (const env of props.environments) {
      newConfigs[env.id] = {
        target: null,
        prefix: null
      }
      showAdvanced.value[env.id] = false
    }

    // Load existing configs from database
    const { data: existingConfigs } = await getConfigsForProjectSync(props.projectSyncConfig.id)

    if (existingConfigs && existingConfigs.length > 0) {
      // Populate envConfigs from existing data
      for (const config of existingConfigs) {
        const targetConfig = isGitHubTargetConfig(config.target_config)
          ? config.target_config
          : null

        if (newConfigs[config.environment_id]) {
          newConfigs[config.environment_id] = {
            target: targetConfig,
            prefix: config.prefix
          }
        }
      }

    }

    // Load sync options from project sync config
    syncOptions.autoSync = props.projectSyncConfig.auto_sync
    syncOptions.syncSecrets = props.projectSyncConfig.sync_secrets
    syncOptions.syncVariables = props.projectSyncConfig.sync_variables
    syncOptions.syncMode = (props.projectSyncConfig.sync_mode as 'all' | 'selected') || 'all'
    syncOptions.variableStorageMode = (props.projectSyncConfig.variable_storage_mode as 'preserve_types' | 'all_as_secrets') || 'preserve_types'

    initialSyncOptions.value = {
      autoSync: props.projectSyncConfig.auto_sync,
      syncSecrets: props.projectSyncConfig.sync_secrets,
      syncVariables: props.projectSyncConfig.sync_variables,
      syncMode: (props.projectSyncConfig.sync_mode as 'all' | 'selected') || 'all',
      variableStorageMode: (props.projectSyncConfig.variable_storage_mode as 'preserve_types' | 'all_as_secrets') || 'preserve_types'
    }

    envConfigs.value = newConfigs
    initialConfigs.value = JSON.parse(JSON.stringify(newConfigs))

    if (syncOptions.syncMode === 'selected') {
      await preloadSelectedModeVariables()
    }

    loading.value = false
  }
})

watch(() => syncOptions.syncMode, (mode) => {
  if (mode === 'all') {
    variableSelectorEnvId.value = null
    variableSearch.value = ''
    return
  }

  if (mode === 'selected') {
    void preloadSelectedModeVariables()
  }
})
</script>
