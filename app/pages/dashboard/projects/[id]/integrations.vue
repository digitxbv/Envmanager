<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <!-- Loading -->
    <LoadingSpinner v-if="loading" class="py-20" />

    <template v-else-if="project">
      <!-- Header -->
      <PageHeader title="Integrations" description="Enable platform integrations to sync environment variables" />

      <!-- Platform Cards -->
      <div class="grid gap-4 lg:grid-cols-2">
        <!-- GitHub Card -->
        <Card padding="sm" class="!p-0 overflow-hidden">
          <div class="space-y-4 p-4">
          <GitHubIntegrationCard
            :installation="selectedGitHubInstallation"
            :installations="githubInstallations"
            :selected-installation-id="selectedGitHubInstallationId"
            :project-sync-config="githubProjectSyncConfig"
            :project-id="projectId"
            :can-manage="canManageIntegrations"
            :loading="githubLoading"
            :syncing="githubSyncing"
            :env-config-count="githubEnvConfigs.length"
            @update:selected-installation-id="handleGitHubInstallationSelected"
            @enable="handleGitHubEnable"
            @disable="handleGitHubDisable"
            @configure="handleGitHubConfigure"
            @sync="handleGitHubSync"
          />

          <!-- Sync Status (when enabled) -->
          <div v-if="githubProjectSyncConfig" class="pl-4 border-l-2 border-muted">
            <SyncStatus
              :last-synced-at="githubProjectSyncConfig.last_synced_at"
              :last-status="githubProjectSyncConfig.last_status as 'success' | 'partial' | 'failed' | null"
              :last-error="githubProjectSyncConfig.last_error"
              :syncing="githubSyncing"
              :sync-progress="githubSyncProgress"
            />
          </div>

          <!-- Sync History (when enabled) -->
          <div v-if="githubProjectSyncConfig" class="space-y-2">
            <button
              type="button"
              class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              @click="showGitHubHistory = !showGitHubHistory"
            >
              <Icon
                name="lucide:chevron-right"
                class="h-4 w-4 transition-transform"
                :class="showGitHubHistory && 'rotate-90'"
              />
              Sync History
            </button>
            <SyncHistory
              v-if="showGitHubHistory"
              :entries="githubHistory"
              :loading="githubHistoryLoading"
              @load-more="loadMoreGitHubHistory"
            />
          </div>
          </div>
        </Card>

        <!-- Platform Cards -->
        <Card v-for="p in platforms" :key="p.config.id" padding="sm" class="!p-0 overflow-hidden">
          <div class="space-y-4 p-4">
            <IntegrationCard
              :platform="p.config"
              :org-connection="p.composable.connection.value"
              :sync-config="p.syncConfig"
              :project-id="projectId"
              :loading="p.composable.loading.value"
              :can-manage="canManageIntegrations"
              @enable="p.handlers.enable"
              @disable="p.handlers.disable"
              @configure="activeConfigurePlatform = p.config.id"
              @sync="p.handlers.sync"
            />

            <div v-if="p.syncConfig" class="pl-4 border-l-2 border-muted">
              <SyncStatus
                :last-synced-at="p.syncConfig.last_synced_at"
                :last-status="p.syncConfig.last_status ?? null"
                :last-error="p.syncConfig.last_error ?? null"
                :syncing="p.syncing"
                :sync-progress="p.syncProgress"
              />
            </div>

            <div v-if="p.syncConfig" class="space-y-2">
              <button
                type="button"
                class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                @click="p.showHistory = !p.showHistory"
              >
                <Icon
                  name="lucide:chevron-right"
                  class="h-4 w-4 transition-transform"
                  :class="p.showHistory && 'rotate-90'"
                />
                Sync History
              </button>
              <SyncHistory
                v-if="p.showHistory"
                :entries="p.history"
                :loading="p.historyLoading"
                @load-more="p.handlers.loadMoreHistory"
              />
            </div>
          </div>
        </Card>
      </div>
    </template>

    <!-- Error -->
    <div v-else class="text-center py-20">
      <p class="text-destructive">Failed to load project</p>
    </div>

    <!-- Configure Modals (no connect modals needed - they're at org level now) -->
    <GitHubConfigureModal
      :open="showGitHubConfigureModal"
      :installation="selectedGitHubInstallation"
      :project-sync-config="githubProjectSyncConfig"
      :project-id="projectId"
      :environments="environments"
      :repositories="githubRepositories"
      :loading-repos="githubReposLoading"
      @close="showGitHubConfigureModal = false"
      @saved="handleGitHubConfigSaved"
    />

    <!-- Platform Configure Modals -->
    <component
      v-for="p in platforms"
      :key="'modal-' + p.config.id"
      :is="p.configureModal"
      :open="activeConfigurePlatform === p.config.id"
      v-bind="p.configureModalProps"
      @close="activeConfigurePlatform = null"
      @saved="p.handlers.configSaved"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

import type { Component } from 'vue'
import type { PlatformConfig, SyncConfig } from '~/types/integration.types'
import type { PlatformIntegration } from '~/composables/usePlatformIntegration'
import IntegrationCard from '~/components/integrations/IntegrationCard.vue'
import SyncStatus from '~/components/integrations/SyncStatus.vue'
import SyncHistory from '~/components/integrations/SyncHistory.vue'
import GitHubIntegrationCard from '~/components/integrations/GitHubIntegrationCard.vue'
import GitHubConfigureModal from '~/components/integrations/GitHubConfigureModal.vue'
import VercelConfigureModal from '~/components/integrations/VercelConfigureModal.vue'
import RailwayConfigureModal from '~/components/integrations/RailwayConfigureModal.vue'
import RenderConfigureModal from '~/components/integrations/RenderConfigureModal.vue'
import DokployConfigureModal from '~/components/integrations/DokployConfigureModal.vue'
import CoolifyConfigureModal from '~/components/integrations/CoolifyConfigureModal.vue'
import GcpConfigureModal from '~/components/integrations/GcpConfigureModal.vue'
import AzureConfigureModal from '~/components/integrations/AzureConfigureModal.vue'
import AwsConfigureModal from '~/components/integrations/AwsConfigureModal.vue'
import { useGitHubIntegration } from '~/composables/useGitHubIntegration'
import { useVercelIntegration, VERCEL_CONFIG } from '~/composables/useVercelIntegration'
import { useRailwayIntegration, RAILWAY_CONFIG } from '~/composables/useRailwayIntegration'
import { useRenderIntegration, RENDER_CONFIG, type RenderSyncTarget } from '~/composables/useRenderIntegration'
import { useDokployIntegration, DOKPLOY_CONFIG } from '~/composables/useDokployIntegration'
import { useCoolifyIntegration, COOLIFY_CONFIG } from '~/composables/useCoolifyIntegration'
import { useGcpIntegration, GCP_CONFIG } from '~/composables/useGcpIntegration'
import { useAzureIntegration, AZURE_CONFIG } from '~/composables/useAzureIntegration'
import { useAwsIntegration, AWS_CONFIG } from '~/composables/useAwsIntegration'
import type { Database } from '~/types/database.types'

// =====================================================
// PlatformEntry Type
// =====================================================

interface PlatformEntry {
  config: PlatformConfig
  composable: PlatformIntegration
  syncing: boolean
  syncProgress: string
  showHistory: boolean
  history: any[]
  historyLoading: boolean
  syncConfig: SyncConfig | null
  configureModal: Component
  configureModalProps: Record<string, any>
  handlers: {
    enable: () => Promise<void>
    disable: () => Promise<void>
    sync: () => Promise<void>
    configSaved: () => void
    loadMoreHistory: () => Promise<void>
  }
}

// =====================================================
// Route & Auth
// =====================================================

const route = useRoute()
const projectId = route.params.id as string
const client = useSupabaseClient<Database>()
const { $toast } = useNuxtApp()
const { track } = usePostHog()

// Breadcrumbs
const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

// =====================================================
// Project & Environments State
// =====================================================

const loading = ref(true)
const project = ref<any>(null)
const environments = ref<Array<{ id: string; name: string }>>([])
const canManageIntegrations = ref(false)

// =====================================================
// GitHub State
// =====================================================

const {
  installation: githubInstallation,
  installations: githubInstallations,
  projectSyncConfig: githubProjectSyncConfig,
  envConfigs: githubEnvConfigs,
  loading: githubLoading,
  fetchInstallations: fetchGitHubInstallations,
  fetchProjectSyncConfig: fetchGitHubProjectSyncConfig,
  fetchRepositories: fetchGitHubRepositories,
  enableForProject: enableGitHubForProject,
  disableForProject: disableGitHubForProject,
  triggerSyncAllEnvs: triggerGitHubSyncAllEnvs,
  fetchSyncHistoryV11: fetchGitHubSyncHistory
} = useGitHubIntegration()

const showGitHubConfigureModal = ref(false)
const showGitHubHistory = ref(false)
const githubSyncing = ref(false)
const githubSyncProgress = ref('')
const githubHistory = ref<any[]>([])
const githubHistoryLoading = ref(false)
const githubRepositories = ref<any[]>([])
const githubReposLoading = ref(false)
const selectedGitHubInstallationId = ref<string | null>(null)

const selectedGitHubInstallation = computed(() => {
  return githubInstallations.value.find(item => item.id === selectedGitHubInstallationId.value) ||
    githubInstallation.value ||
    null
})

// =====================================================
// Platform Integration (data-driven)
// =====================================================

const activeConfigurePlatform = ref<string | null>(null)

const vercel = useVercelIntegration()
const railway = useRailwayIntegration()
const render = useRenderIntegration()
const dokploy = useDokployIntegration()
const coolify = useCoolifyIntegration()
const gcp = useGcpIntegration()
const azure = useAzureIntegration()
const aws = useAwsIntegration()

function buildPlatformEntry(
  config: PlatformConfig,
  composable: PlatformIntegration,
  configureModal: Component,
  getModalProps: () => Record<string, any>
): PlatformEntry {
  const syncing = ref(false)
  const syncProgress = ref('')
  const showHistory = ref(false)
  const history = ref<any[]>([])
  const historyLoading = ref(false)
  const syncConfig = computed(() => composable.syncConfigs.value[0] ?? null)

  async function loadSyncData() {
    if (!composable.connection.value) return
    historyLoading.value = true
    history.value = await composable.fetchSyncHistory(composable.connection.value.id)
    historyLoading.value = false
  }

  return reactive({
    config,
    composable: markRaw(composable),
    syncing,
    syncProgress,
    showHistory,
    history,
    historyLoading,
    syncConfig,
    configureModal: markRaw(configureModal) as Component,
    configureModalProps: computed(getModalProps),
    handlers: markRaw({
      enable: async () => {
        if (!composable.connection.value) return
        const result = await composable.enableForProject(composable.connection.value.id, projectId)
        if (result) {
          track('integration_connected', { provider: config.id, project_id: projectId })
          activeConfigurePlatform.value = config.id
        }
      },
      disable: async () => {
        await composable.disableForProject(projectId)
        track('integration_disconnected', { provider: config.id, project_id: projectId })
      },
      sync: async () => {
        if (!composable.connection.value) {
          activeConfigurePlatform.value = config.id
          return
        }
        syncing.value = true
        syncProgress.value = 'Syncing all environments...'
        try {
          await composable.triggerSyncAllEnvs(composable.connection.value.id)
          track('integration_synced', { provider: config.id, project_id: projectId })
          await loadSyncData()
        } finally {
          syncing.value = false
          syncProgress.value = ''
        }
      },
      configSaved: () => {
        composable.fetchSyncConfigsForProject(projectId)
      },
      loadMoreHistory: async () => {
        if (!composable.connection.value) return
        historyLoading.value = true
        history.value = await composable.fetchSyncHistory(composable.connection.value.id, history.value.length + 10)
        historyLoading.value = false
      }
    })
  }) as PlatformEntry
}

const platforms: PlatformEntry[] = [
  buildPlatformEntry(VERCEL_CONFIG, vercel, VercelConfigureModal, () => ({
    connection: vercel.connection.value,
    projectId,
    projectIntegrationId: vercel.connection.value?.id || '',
    environments: environments.value
  })),
  buildPlatformEntry(RAILWAY_CONFIG, railway, RailwayConfigureModal, () => ({
    connection: railway.connection.value,
    projectId,
    projectIntegrationId: railway.connection.value?.id || '',
    environments: environments.value
  })),
  buildPlatformEntry(RENDER_CONFIG, render, RenderConfigureModal, () => ({
    connection: render.connection.value,
    projectId,
    environments: environments.value,
    existingConfig: render.syncConfigs.value[0] ? {
      target: render.syncConfigs.value[0].target as unknown as RenderSyncTarget,
      autoSync: render.syncConfigs.value[0].auto_sync,
      syncSecrets: render.syncConfigs.value[0].sync_secrets,
      syncVariables: render.syncConfigs.value[0].sync_variables
    } : null
  })),
  buildPlatformEntry(DOKPLOY_CONFIG, dokploy, DokployConfigureModal, () => ({
    connection: dokploy.connection.value,
    projectId,
    environments: environments.value,
    existingConfig: dokploy.syncConfigs.value[0] ?? null
  })),
  buildPlatformEntry(COOLIFY_CONFIG, coolify, CoolifyConfigureModal, () => ({
    connection: coolify.connection.value,
    projectId,
    environments: environments.value,
    existingConfig: coolify.syncConfigs.value[0] ?? null
  })),
  buildPlatformEntry(GCP_CONFIG, gcp, GcpConfigureModal, () => ({
    connection: gcp.connection.value,
    projectId,
    projectIntegrationId: gcp.connection.value?.id || '',
    environments: environments.value
  })),
  buildPlatformEntry(AZURE_CONFIG, azure, AzureConfigureModal, () => ({
    connection: azure.connection.value,
    projectId,
    projectIntegrationId: azure.connection.value?.id || '',
    environments: environments.value
  })),
  buildPlatformEntry(AWS_CONFIG, aws, AwsConfigureModal, () => ({
    connection: aws.connection.value,
    projectId,
    projectIntegrationId: aws.connection.value?.id || '',
    environments: environments.value
  })),
]

// =====================================================
// Load Project
// =====================================================

async function loadProject() {
  loading.value = true

  try {
    // Load project
    const { data: projectData, error: projectError } = await client
      .from('projects')
      .select('*, organization:organizations(*)')
      .eq('id', projectId)
      .single()

    if (projectError || !projectData) {
      $toast.error('Project not found or access denied')
      navigateTo('/dashboard', { replace: true })
      return
    }

    project.value = projectData

    // Set breadcrumbs
    breadcrumbs.value = [
      { label: 'Dashboard', to: '/dashboard' },
      { label: projectData.name, to: `/dashboard/projects/${projectId}` },
      { label: 'Integrations' }
    ]

    // Load environments
    const { data: envData } = await client
      .from('environments')
      .select('id, name')
      .eq('project_id', projectId)
      .order('name')

    environments.value = envData || []

    // Check user permissions
    const { data: { user } } = await client.auth.getUser()
    const userId = user?.id

    if (userId) {
      const { data: membership } = await client
        .from('organization_members')
        .select('role')
        .eq('organization_id', projectData.organization_id)
        .eq('user_id', userId)
        .single()

      canManageIntegrations.value = membership?.role === 'owner' || membership?.role === 'admin'
    }

    // Load org connections for all platforms (in parallel)
    await Promise.all([
      fetchGitHubInstallations(projectData.organization_id),
      ...platforms.map(p => p.composable.fetchOrgConnection(projectData.organization_id))
    ])

    // Load existing sync configs for this project (in parallel)
    const [githubConfig] = await Promise.all([
      githubInstallations.value.length > 0 ? fetchGitHubProjectSyncConfig(projectId, null) : Promise.resolve(null),
      ...platforms.map(p => p.composable.fetchSyncConfigsForProject(projectId))
    ])

    selectedGitHubInstallationId.value = githubConfig?.installation_id ||
      githubInstallations.value[0]?.id ||
      null

  } finally {
    loading.value = false
  }
}

// =====================================================
// GitHub Handlers
// =====================================================

async function handleGitHubConfigure() {
  if (!selectedGitHubInstallation.value) return
  githubReposLoading.value = true
  showGitHubConfigureModal.value = true
  githubRepositories.value = await fetchGitHubRepositories(selectedGitHubInstallation.value.id)
  githubReposLoading.value = false
}

async function handleGitHubEnable() {
  if (!selectedGitHubInstallation.value) return
  const config = await enableGitHubForProject(selectedGitHubInstallation.value.id, projectId)
  if (config) {
    track('integration_connected', {
      provider: 'github',
      project_id: projectId
    })
    await handleGitHubConfigure()
  }
}

async function handleGitHubDisable() {
  if (!selectedGitHubInstallation.value) return
  await disableGitHubForProject(projectId, selectedGitHubInstallation.value.id)
  track('integration_disconnected', {
    provider: 'github',
    project_id: projectId
  })
}

async function handleGitHubSync() {
  if (!githubProjectSyncConfig.value) {
    showGitHubConfigureModal.value = true
    return
  }

  githubSyncing.value = true
  githubSyncProgress.value = 'Syncing all environments...'

  try {
    await triggerGitHubSyncAllEnvs(githubProjectSyncConfig.value.id)
    track('integration_synced', {
      provider: 'github',
      project_id: projectId
    })
    await loadGitHubSyncData()
  } finally {
    githubSyncing.value = false
    githubSyncProgress.value = ''
  }
}

async function loadGitHubSyncData() {
  if (!githubProjectSyncConfig.value) return
  githubHistoryLoading.value = true
  githubHistory.value = await fetchGitHubSyncHistory(githubProjectSyncConfig.value.id)
  githubHistoryLoading.value = false
}

function handleGitHubConfigSaved() {
  if (selectedGitHubInstallation.value) {
    fetchGitHubProjectSyncConfig(projectId, selectedGitHubInstallation.value.id)
  }
}

async function handleGitHubInstallationSelected(installationId: string) {
  selectedGitHubInstallationId.value = installationId
  githubRepositories.value = []
  githubHistory.value = []
  await fetchGitHubProjectSyncConfig(projectId, installationId)
}

async function loadMoreGitHubHistory() {
  if (!githubProjectSyncConfig.value) return
  githubHistoryLoading.value = true
  githubHistory.value = await fetchGitHubSyncHistory(githubProjectSyncConfig.value.id, githubHistory.value.length + 10)
  githubHistoryLoading.value = false
}

// =====================================================
// Watchers
// =====================================================

watch(githubProjectSyncConfig, (config) => {
  if (config) loadGitHubSyncData()
})

for (const p of platforms) {
  const composable = p.composable
  watch(composable.connection, async (connection) => {
    if (connection) {
      p.historyLoading = true
      p.history = await composable.fetchSyncHistory(connection.id) as any[]
      p.historyLoading = false
    }
  })
}

// =====================================================
// Lifecycle
// =====================================================

onMounted(() => {
  loadProject()
})
</script>
