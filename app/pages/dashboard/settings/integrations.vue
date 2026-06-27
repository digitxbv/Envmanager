<template>
  <div class="space-y-6">
    <!-- Loading role check -->
    <LoadingSpinner v-if="roleLoading" class="py-12" />

    <!-- Access restricted for non-admins -->
    <Card v-else-if="!isAdmin" class-name="text-center">
      <EmptyState
        icon="lucide:lock"
        title="Access Restricted"
        description="Only organization admins can manage integrations."
      />
    </Card>

    <template v-else>
      <div class="space-y-1 mb-4">
        <h2 class="text-base font-semibold">Integrations</h2>
        <p class="text-sm text-muted-foreground">
          Connect external services to sync your environment variables
        </p>
      </div>

      <LoadingSpinner v-if="loadingIntegrations" class="py-12" />

      <div v-else class="grid gap-4 lg:grid-cols-2">
        <!-- GitHub Integration -->
        <GitHubConnectCard
          v-if="selectedOrganizationId"
          :organization-id="selectedOrganizationId"
          :installation="normalizedGitHubInstallation"
          :installations="normalizedGitHubInstallations"
          :is-connected="isAnyGitHubConnected"
          :loading="githubLoading"
          @connect="handleGitHubConnect"
          @disconnect="handleGitHubDisconnect"
        />

        <!-- Deployment Platforms -->
        <OrgIntegrationCard
          v-for="{ config, key } in platformConfigs"
          :key="key"
          :platform="config"
          :connection="orgConnections[key] ?? null"
          :project-count="projectCounts[key] ?? 0"
          :can-manage="canManageIntegrations"
          @connect="handlePlatformConnect(key)"
          @disconnect="handlePlatformDisconnect(key)"
        />
      </div>

      <!-- Platform Connect Modals -->
      <ClientOnly>
        <component
          v-if="showConnectModal"
          :is="connectModals[showConnectModal.platform]"
          :open="true"
          :organization-id="selectedOrganizationId || ''"
          @close="showConnectModal = null"
          @connected="handleConnectionSuccess"
        />
      </ClientOnly>

      <!-- Disconnect Warning Modal -->
      <ClientOnly>
        <DisconnectWarningModal
          v-if="showDisconnectWarning"
          :open="true"
          :connection-id="showDisconnectWarning.connectionId"
          :platform="showDisconnectWarning.platformConfig"
          :projects="showDisconnectWarning.projects"
          @close="showDisconnectWarning = null"
          @confirm="handleDisconnectConfirmed"
        />
      </ClientOnly>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import GitHubConnectCard from '@/components/integrations/GitHubConnectCard.vue'
import OrgIntegrationCard from '@/components/integrations/OrgIntegrationCard.vue'
import DisconnectWarningModal from '@/components/integrations/DisconnectWarningModal.vue'
import VercelConnectModal from '@/components/integrations/VercelConnectModal.vue'
import RailwayConnectModal from '@/components/integrations/RailwayConnectModal.vue'
import RenderConnectModal from '@/components/integrations/RenderConnectModal.vue'
import DokployConnectModal from '@/components/integrations/DokployConnectModal.vue'
import CoolifyConnectModal from '@/components/integrations/CoolifyConnectModal.vue'
import GcpConnectModal from '@/components/integrations/GcpConnectModal.vue'
import AzureConnectModal from '@/components/integrations/AzureConnectModal.vue'
import AwsConnectModal from '@/components/integrations/AwsConnectModal.vue'
import type { PlatformConfig, PlatformConnection } from '~/types/integration.types'
import { VERCEL_CONFIG, useVercelIntegration } from '~/composables/useVercelIntegration'
import { RAILWAY_CONFIG, useRailwayIntegration } from '~/composables/useRailwayIntegration'
import { RENDER_CONFIG, useRenderIntegration } from '~/composables/useRenderIntegration'
import { DOKPLOY_CONFIG, useDokployIntegration } from '~/composables/useDokployIntegration'
import { COOLIFY_CONFIG, useCoolifyIntegration } from '~/composables/useCoolifyIntegration'
import { GCP_CONFIG, useGcpIntegration } from '~/composables/useGcpIntegration'
import { AZURE_CONFIG, useAzureIntegration } from '~/composables/useAzureIntegration'
import { AWS_CONFIG, useAwsIntegration } from '~/composables/useAwsIntegration'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

// =====================================================
// Core Composables
// =====================================================

const user = useSupabaseUser()
const { $toast } = useNuxtApp()
const organizationStore = useOrganizationStore()
const { getCurrentUserRole } = useTeamManagement()

const {
  installation: githubInstallation,
  installations: githubInstallations,
  isAnyConnected: isAnyGitHubConnected,
  loading: githubLoading,
  fetchInstallations: fetchGitHubInstallations,
  connectGitHub,
  disconnectGitHub
} = useGitHubIntegration()

// Platform composables
const vercelIntegration = useVercelIntegration()
const railwayIntegration = useRailwayIntegration()
const renderIntegration = useRenderIntegration()
const dokployIntegration = useDokployIntegration()
const coolifyIntegration = useCoolifyIntegration()
const gcpIntegration = useGcpIntegration()
const azureIntegration = useAzureIntegration()
const awsIntegration = useAwsIntegration()

// Connect modal components mapped by platform key
const connectModals: Record<string, Component> = {
  vercel: VercelConnectModal,
  railway: RailwayConnectModal,
  render: RenderConnectModal,
  dokploy: DokployConnectModal,
  coolify: CoolifyConnectModal,
  gcp: GcpConnectModal,
  azure: AzureConnectModal,
  aws: AwsConnectModal
}

// =====================================================
// Reactive State
// =====================================================

const currentUserRole = ref<'owner' | 'admin' | 'member' | 'viewer' | null>(null)
const roleLoading = ref(true)

// Platform integrations state
const orgConnections = ref<Record<string, PlatformConnection | null>>({
  vercel: null,
  railway: null,
  render: null,
  dokploy: null,
  coolify: null,
  gcp: null,
  azure: null,
  aws: null
})
const projectCounts = ref<Record<string, number>>({
  vercel: 0,
  railway: 0,
  render: 0,
  dokploy: 0,
  coolify: 0,
  gcp: 0,
  azure: 0,
  aws: 0
})
const loadingIntegrations = ref(true)

// Modal state
const showConnectModal = ref<{ platform: string } | null>(null)
const showDisconnectWarning = ref<{
  platform: string
  platformConfig: PlatformConfig
  connectionId: string
  projects: Array<{ id: string; name: string }>
} | null>(null)

// =====================================================
// Computed Properties
// =====================================================

const selectedOrganizationId = computed(() => organizationStore.selectedOrganizationId)

const isAdmin = computed(() => {
  return currentUserRole.value === 'owner' || currentUserRole.value === 'admin'
})

const canManageIntegrations = computed(() => {
  if (currentUserRole.value === null) return false
  return currentUserRole.value === 'owner' || currentUserRole.value === 'admin'
})

const platformConfigs = [
  { config: VERCEL_CONFIG, key: 'vercel' as const },
  { config: RAILWAY_CONFIG, key: 'railway' as const },
  { config: RENDER_CONFIG, key: 'render' as const },
  { config: DOKPLOY_CONFIG, key: 'dokploy' as const },
  { config: COOLIFY_CONFIG, key: 'coolify' as const },
  { config: GCP_CONFIG, key: 'gcp' as const },
  { config: AZURE_CONFIG, key: 'azure' as const },
  { config: AWS_CONFIG, key: 'aws' as const }
]

const normalizedGitHubInstallation = computed(() => {
  if (!githubInstallation.value) return null

  return {
    id: githubInstallation.value.id,
    installation_id: githubInstallation.value.installation_id,
    account_login: githubInstallation.value.account_login,
    account_type: githubInstallation.value.account_type,
    installed_at: githubInstallation.value.installed_at ?? githubInstallation.value.created_at ?? ''
  }
})

const normalizedGitHubInstallations = computed(() => {
  return githubInstallations.value.map(item => ({
    id: item.id,
    installation_id: item.installation_id,
    account_login: item.account_login,
    account_type: item.account_type,
    installed_at: item.installed_at ?? item.created_at ?? ''
  }))
})

// =====================================================
// Methods
// =====================================================

const handleGitHubConnect = () => {
  if (!selectedOrganizationId.value) {
    $toast.error('No organization selected')
    return
  }
  connectGitHub(selectedOrganizationId.value)
}

const handleGitHubDisconnect = async (installationId?: string) => {
  if (!selectedOrganizationId.value) return
  await disconnectGitHub(selectedOrganizationId.value, installationId)
}

/**
 * Get composable for a platform
 */
function getComposableForPlatform(platform: string) {
  switch (platform) {
    case 'vercel': return vercelIntegration
    case 'railway': return railwayIntegration
    case 'render': return renderIntegration
    case 'dokploy': return dokployIntegration
    case 'coolify': return coolifyIntegration
    case 'gcp': return gcpIntegration
    case 'azure': return azureIntegration
    case 'aws': return awsIntegration
    default: throw new Error(`Unknown platform: ${platform}`)
  }
}

/**
 * Load all organization-level integrations
 */
async function loadOrgIntegrations() {
  if (!selectedOrganizationId.value) return

  loadingIntegrations.value = true

  try {
    const platforms = ['vercel', 'railway', 'render', 'dokploy', 'coolify', 'gcp', 'azure', 'aws'] as const

    const results = await Promise.allSettled(platforms.map(async (platform) => {
      const composable = getComposableForPlatform(platform)
      const conn = await composable.fetchOrgConnection(selectedOrganizationId.value!)
      orgConnections.value[platform] = conn

      // Get project count if connected
      if (conn) {
        const count = await composable.getDependentProjectCount(conn.id)
        projectCounts.value[platform] = count
      } else {
        projectCounts.value[platform] = 0
      }
    }))

    // Log any failures but don't block others
    const failures = results.filter(r => r.status === 'rejected')
    if (failures.length > 0) {
      console.error('Some integrations failed to load:', failures)
      $toast.error('Some integrations failed to load')
    }
  } catch (error) {
    console.error('Failed to load org integrations:', error)
    $toast.error('Failed to load integrations')
  } finally {
    loadingIntegrations.value = false
  }
}

/**
 * Handle connect button click
 */
async function handlePlatformConnect(platform: string) {
  if (!canManageIntegrations.value) {
    $toast.error('Only admins can manage integrations')
    return
  }

  // Check integration limit before opening modal
  const { enforceLimit } = useLimits()
  const allowed = await enforceLimit('integrations')
  if (!allowed) return

  showConnectModal.value = { platform }
}

/**
 * Handle disconnect button click
 */
async function handlePlatformDisconnect(platform: string) {
  if (!canManageIntegrations.value) {
    $toast.error('Only admins can manage integrations')
    return
  }

  const connection = orgConnections.value[platform]
  if (!connection) return

  // Get platform config
  const platformConfig = platformConfigs.find(p => p.key === platform)?.config
  if (!platformConfig) return

  // Fetch dependent projects
  const composable = getComposableForPlatform(platform)
  const projects = await composable.getDependentProjects(connection.id)

  showDisconnectWarning.value = {
    platform,
    platformConfig,
    connectionId: connection.id,
    projects
  }
}

/**
 * Handle disconnect confirmation
 */
async function handleDisconnectConfirmed() {
  if (!showDisconnectWarning.value) return

  const { platform, connectionId } = showDisconnectWarning.value
  const composable = getComposableForPlatform(platform)

  await composable.disconnect(connectionId)
  showDisconnectWarning.value = null
  await loadOrgIntegrations()
}

/**
 * Handle successful connection from modal
 */
async function handleConnectionSuccess() {
  showConnectModal.value = null
  await loadOrgIntegrations()
}

// =====================================================
// Lifecycle
// =====================================================

// Handle GitHub callback query params
onMounted(() => {
  const route = useRoute()
  const githubStatus = route.query.github as string
  const error = route.query.error as string

  if (githubStatus === 'connected') {
    $toast.success('GitHub connected successfully!')
    navigateTo('/dashboard/settings/integrations', { replace: true })
  }

  if (error) {
    $toast.error(error)
    navigateTo('/dashboard/settings/integrations', { replace: true })
  }
})

// Watch for org + user to load role and integrations
watch(
  [selectedOrganizationId, user],
  async ([orgId, currentUser]) => {
    const userId = currentUser?.id ?? currentUser?.sub
    if (!orgId || !userId) return

    roleLoading.value = true
    try {
      const role = await getCurrentUserRole(orgId)
      currentUserRole.value = role || 'member'
    } finally {
      roleLoading.value = false
    }

    await fetchGitHubInstallations(orgId)
    await loadOrgIntegrations()
  },
  { immediate: true }
)
</script>
