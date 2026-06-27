<template>
  <div class="space-y-3">
    <!-- Last Synced + Status -->
    <div class="flex items-center gap-3">
      <!-- Status Badge -->
      <span
        class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
        :class="statusClasses"
      >
        <Icon :name="statusIcon || 'lucide:circle'" class="mr-1 h-4 w-4" />
        {{ statusText }}
      </span>

      <!-- Last Synced Time -->
      <span
        v-if="lastSyncedAt"
        class="inline-flex items-center gap-1 text-xs text-muted-foreground"
        :title="absoluteTime"
      >
        <Icon name="lucide:clock" class="h-4 w-4" />
        {{ relativeTime }}
      </span>
      <span v-else class="text-xs text-muted-foreground">
        Never synced
      </span>
    </div>

    <!-- Sync Progress (when syncing) -->
    <div
      v-if="syncing"
      class="flex items-center gap-2 text-sm text-primary"
    >
      <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
      <span>{{ syncProgress || 'Syncing...' }}</span>
    </div>

    <!-- Pending Changes -->
    <div v-if="pendingChanges && pendingChanges.length > 0" class="space-y-2">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
        @click="pendingExpanded = !pendingExpanded"
      >
        <Icon name="lucide:alert-circle" class="h-4 w-4" />
        {{ pendingChanges.length }} pending change{{ pendingChanges.length !== 1 ? 's' : '' }}
        <Icon
          name="lucide:chevron-down"
          class="h-4 w-4 transition-transform"
          :class="pendingExpanded && 'rotate-180'"
        />
      </button>

      <!-- Expanded pending changes list -->
      <div
        v-if="pendingExpanded"
        class="rounded-md border bg-muted/30 p-2 text-xs space-y-1"
      >
        <div
          v-for="change in pendingChanges"
          :key="change.key"
          class="flex items-center gap-2"
        >
          <span
            class="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-medium"
            :class="changeTypeClasses[change.type]"
          >
            {{ changeTypeIcon[change.type] }}
          </span>
          <code class="font-mono text-muted-foreground">{{ change.key }}</code>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div
      v-if="lastStatus === 'failed' && lastError"
      class="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive"
    >
      <Icon name="lucide:alert-circle" class="h-4 w-4 shrink-0 mt-0.5" />
      <p>{{ lastError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PendingChange } from '~/types/integration.types'

interface Props {
  lastSyncedAt: string | null
  lastStatus: 'success' | 'partial' | 'failed' | null
  lastError: string | null
  pendingChanges?: PendingChange[]
  syncing?: boolean
  syncProgress?: string
}

const props = defineProps<Props>()

// =====================================================
// State
// =====================================================

const pendingExpanded = ref(false)

// =====================================================
// Composables
// =====================================================

const { relativeTime, absoluteTime } = useRelativeTime(() => props.lastSyncedAt)

// =====================================================
// Computed
// =====================================================

const statusText = computed(() => {
  if (!props.lastStatus) return 'Never synced'
  switch (props.lastStatus) {
    case 'success': return 'Synced'
    case 'partial': return 'Partial'
    case 'failed': return 'Failed'
    default: return props.lastStatus
  }
})

const statusIcon = computed(() => {
  if (!props.lastStatus) return 'lucide:circle-dashed'
  switch (props.lastStatus) {
    case 'success': return 'lucide:check-circle'
    case 'partial': return 'lucide:alert-triangle'
    case 'failed': return 'lucide:x-circle'
    default: return 'lucide:circle'
  }
})

const statusClasses = computed(() => {
   if (!props.lastStatus) {
     return 'bg-muted text-muted-foreground'
   }
   switch (props.lastStatus) {
     case 'success':
       return 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400'
     case 'partial':
       return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
     case 'failed':
       return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
     default:
       return 'bg-muted text-muted-foreground'
   }
 })

// =====================================================
// Constants
// =====================================================

const changeTypeClasses: Record<string, string> = {
   added: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
   modified: 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-400',
   removed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
 }

const changeTypeIcon: Record<string, string> = {
  added: '+',
  modified: '~',
  removed: '-'
}
</script>
