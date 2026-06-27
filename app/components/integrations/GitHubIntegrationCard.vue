<template>
  <div class="rounded-lg border bg-card p-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-4">
        <!-- GitHub Icon -->
        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-[#24292f] text-white">
          <Icon name="lucide:github" class="h-5 w-5" />
        </div>

        <!-- Platform Info -->
        <div>
          <h3 class="text-lg font-semibold">GitHub</h3>
          <p class="text-sm text-muted-foreground">
            Sync to GitHub Actions secrets and variables
          </p>
        </div>
      </div>

      <!-- Status Badge -->
      <div v-if="isEnabled" class="flex items-center gap-2">
        <span class="inline-flex items-center rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-medium text-success-800 dark:bg-success-900/30 dark:text-success-400">
          <Icon name="lucide:check-circle" class="mr-1 h-4 w-4" />
          Enabled
        </span>
      </div>
    </div>

    <!-- State 1: Org not connected (no GitHub installation) -->
    <div v-if="installations.length === 0" class="mt-6">
      <div class="rounded-md bg-muted/50 p-4">
        <div class="flex items-start gap-3">
          <Icon name="lucide:info" class="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p class="text-sm font-medium">Not available</p>
            <p class="text-sm text-muted-foreground mt-1">
              GitHub needs to be connected at the organization level first.
            </p>
            <NuxtLink
              v-if="canManage"
              to="/dashboard/settings/integrations"
              class="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:text-primary/90 hover:underline transition-colors"
            >
              <Icon name="lucide:settings" class="h-4 w-4" />
              Add in Organization Settings
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- State 2: GitHub suspended or uninstalled -->
    <div v-else-if="selectedInstallation && isSuspendedOrUninstalled" class="mt-6">
      <div class="rounded-md bg-amber-100 p-4 dark:bg-amber-900/30">
        <div class="flex items-start gap-3">
          <Icon name="lucide:alert-triangle" class="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p class="text-sm font-medium text-amber-800 dark:text-amber-300">
              {{ selectedInstallation.suspended_at ? 'App Suspended' : 'App Uninstalled' }}
            </p>
            <p class="text-sm text-amber-700 dark:text-amber-400 mt-1">
              {{ selectedInstallation.suspended_at
                ? 'The GitHub App has been suspended. Please unsuspend it in GitHub.'
                : 'The GitHub App has been uninstalled. Please reinstall it to continue syncing.'
              }}
            </p>
            <NuxtLink
              v-if="canManage"
               to="/dashboard/settings/integrations"
              class="mt-2 inline-flex items-center gap-1 text-sm text-amber-800 dark:text-amber-300 hover:underline transition-colors"
            >
              <Icon name="lucide:external-link" class="h-4 w-4" />
              Reconnect in Organization Settings
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- State 3: GitHub connected and active -->
    <div v-else class="mt-6 space-y-4">
      <div v-if="installations.length > 1" class="space-y-2">
        <label class="block text-sm font-medium">GitHub account or organization</label>
        <select
          :value="selectedInstallationId"
          class="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          :disabled="loading"
          @change="handleInstallationChange"
        >
          <option
            v-for="item in installations"
            :key="item.id"
            :value="item.id"
          >
            {{ item.account_login }} ({{ item.account_type }})
          </option>
        </select>
      </div>

      <!-- Connection Info -->
      <div class="flex items-center gap-3 rounded-md bg-muted/50 p-3">
        <Icon
          :name="selectedInstallation?.account_type === 'Organization' ? 'lucide:building-2' : 'lucide:user'"
          class="h-5 w-5 text-muted-foreground"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm text-muted-foreground">GitHub {{ selectedInstallation?.account_type }}</p>
          <p class="font-medium truncate">{{ selectedInstallation?.account_login }}</p>
        </div>

        <!-- Enable/Disable Toggle -->
        <div v-if="canManage" class="shrink-0">
          <button
            type="button"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            :class="isEnabled ? 'bg-primary' : 'bg-muted-foreground/30'"
            :disabled="loading"
            @click="handleToggle"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              :class="isEnabled ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>
      </div>

      <!-- Not enabled hint -->
      <p v-if="!isEnabled && canManage" class="text-sm text-muted-foreground">
        Enable the toggle to use GitHub for this project
      </p>

      <!-- Enabled: Show actions -->
      <div v-if="isEnabled && projectSyncConfig" class="space-y-4">
        <!-- Config Summary -->
        <div v-if="hasTarget" class="rounded-md border p-3">
          <div class="flex items-center gap-2 text-sm">
            <Icon name="lucide:target" class="h-4 w-4 text-muted-foreground" />
            <span class="font-medium">Target:</span>
            <span class="text-muted-foreground">{{ targetSummary }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3">
          <!-- Primary: Sync Now -->
          <Button
            @click="$emit('sync')"
            :loading="syncing"
            :disabled="syncing || !hasTarget"
          >
            <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
            Sync Now
          </Button>

          <!-- Configure -->
          <Button variant="outline" @click="$emit('configure')">
            <Icon name="lucide:settings" class="mr-2 h-4 w-4" />
            Configure
          </Button>
        </div>

        <!-- Configure hint if no target -->
        <p v-if="!hasTarget" class="text-sm text-amber-600 dark:text-amber-400">
          <Icon name="lucide:alert-triangle" class="inline h-4 w-4 mr-1" />
          Configure the sync target before syncing
        </p>
      </div>

      <!-- No permission message -->
      <div v-if="!canManage" class="text-sm text-muted-foreground">
        <Icon name="lucide:shield" class="inline h-4 w-4 mr-1" />
        Contact an admin to manage this integration
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '~/components/ui/Button.vue'
import type { Database } from '~/types/database.types'

type GitHubInstallation = Database['public']['Tables']['github_installations']['Row']
type GitHubProjectSyncConfig = Database['public']['Tables']['github_project_sync_configs']['Row']

interface Props {
  installation: GitHubInstallation | null
  installations?: GitHubInstallation[]
  selectedInstallationId?: string | null
  projectSyncConfig: GitHubProjectSyncConfig | null
  projectId: string
  canManage?: boolean
  loading?: boolean
  syncing?: boolean
  envConfigCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  installations: () => [],
  selectedInstallationId: null,
  canManage: true,
  loading: false,
  syncing: false,
  envConfigCount: 0
})

const emit = defineEmits<{
  enable: []
  disable: []
  configure: []
  sync: []
  'update:selectedInstallationId': [installationId: string]
}>()

// =====================================================
// Computed
// =====================================================

const isEnabled = computed(() => props.projectSyncConfig !== null)

const installations = computed(() => {
  if (props.installations.length > 0) return props.installations
  return props.installation ? [props.installation] : []
})

const selectedInstallation = computed(() => {
  return installations.value.find(item => item.id === props.selectedInstallationId) || installations.value[0] || null
})

const isSuspendedOrUninstalled = computed(() => {
  if (!selectedInstallation.value) return false
  return !!selectedInstallation.value.suspended_at || !!selectedInstallation.value.uninstalled_at
})

const hasTarget = computed(() => {
  // Check if we have any environment configs
  return props.envConfigCount > 0
})

const targetSummary = computed(() => {
  if (props.envConfigCount === 0) return 'Not configured'
  return `${props.envConfigCount} environment${props.envConfigCount !== 1 ? 's' : ''} configured`
})

// =====================================================
// Methods
// =====================================================

function handleToggle() {
  if (isEnabled.value) {
    // Confirm before disabling
    if (confirm('Disable GitHub for this project? This will remove the sync configuration.')) {
      emit('disable')
    }
  } else {
    emit('enable')
  }
}

function handleInstallationChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update:selectedInstallationId', value)
}
</script>
