<template>
  <div class="rounded-lg border bg-card p-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-4">
        <!-- Platform Icon -->
        <div
          class="flex h-12 w-12 items-center justify-center rounded-lg text-white"
          :style="{ backgroundColor: platform.color }"
        >
          <Icon :name="platform.icon || 'lucide:server'" class="h-5 w-5" />
        </div>

        <!-- Platform Info -->
        <div>
          <h3 class="text-lg font-semibold">{{ platform.name }}</h3>
          <p class="text-sm text-muted-foreground">
            {{ platform.description }}
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

    <!-- State 1: Org not connected -->
    <div v-if="!orgConnection" class="mt-6">
      <div class="rounded-md bg-muted/50 p-4">
        <div class="flex items-start gap-3">
          <Icon name="lucide:info" class="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p class="text-sm font-medium">Not available</p>
            <p class="text-sm text-muted-foreground mt-1">
              {{ platform.name }} needs to be connected at the organization level first.
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

    <!-- State 2 & 3: Org connected -->
    <div v-else class="mt-6 space-y-4">
      <!-- Connection Info -->
      <div class="flex items-center gap-3 rounded-md bg-muted/50 p-3">
        <Icon name="lucide:building" class="h-5 w-5 text-muted-foreground" />
        <div class="flex-1 min-w-0">
          <p class="text-sm text-muted-foreground">Organization connection</p>
          <p class="font-medium truncate">{{ orgConnection.name }}</p>
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
        Enable the toggle to use {{ platform.name }} for this project
      </p>

      <!-- Enabled: Show actions -->
      <div v-if="isEnabled && syncConfig" class="space-y-4">
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
            :loading="loading"
            :disabled="loading || !hasTarget"
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
import type { PlatformConfig, PlatformConnection, SyncConfig } from '~/types/integration.types'

interface Props {
  platform: PlatformConfig
  orgConnection: PlatformConnection | null  // The org-level connection (or null if not connected)
  syncConfig: SyncConfig | null             // The project's sync config (or null if not enabled)
  projectId: string
  canManage?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canManage: true,
  loading: false
})

const emit = defineEmits<{
  enable: []
  disable: []
  configure: []
  sync: []
}>()

// =====================================================
// Computed
// =====================================================

const isEnabled = computed(() => props.syncConfig !== null)

const hasTarget = computed(() => {
  if (!props.syncConfig?.target) return false
  return Object.keys(props.syncConfig.target).length > 0
})

const targetSummary = computed(() => {
  if (!props.syncConfig?.target) return 'Not configured'

  const target = props.syncConfig.target as Record<string, any>

  // Platform-specific target display
  if (target.projectId && target.projectName) {
    return target.projectName
  }
  if (target.serviceId && target.serviceName) {
    return target.serviceName
  }
  if (target.applicationId && target.applicationName) {
    return target.applicationName
  }
  if (target.resourceId && target.resourceName) {
    return target.resourceName
  }

  return 'Configured'
})

// =====================================================
// Methods
// =====================================================

function handleToggle() {
  if (isEnabled.value) {
    // Confirm before disabling
    if (confirm(`Disable ${props.platform.name} for this project? This will remove the sync configuration.`)) {
      emit('disable')
    }
  } else {
    emit('enable')
  }
}
</script>
