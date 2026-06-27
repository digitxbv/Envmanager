<template>
  <div class="space-y-4">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-8">
      <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="entries.length === 0"
      class="text-center py-8 text-sm text-muted-foreground"
    >
      <Icon name="lucide:history" class="h-5 w-5 mx-auto mb-2 opacity-50" />
      <p>No sync history available</p>
    </div>

    <!-- History Entries Grouped by Date -->
    <template v-else>
      <div
        v-for="(group, dateKey) in groupedEntries"
        :key="dateKey"
        class="space-y-2"
      >
        <!-- Date Header -->
        <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {{ dateKey }}
        </h4>

        <!-- Entries for this date -->
        <div class="space-y-1">
          <div
            v-for="entry in group"
            :key="entry.id"
            class="rounded-md border bg-card"
          >
            <!-- Entry Header (always visible) -->
            <button
              type="button"
              class="w-full flex items-center justify-between p-3 text-sm hover:bg-muted/50 transition-colors"
              @click="toggleExpanded(entry.id)"
            >
              <div class="flex items-center gap-3">
                <!-- Status Icon -->
                <Icon
                  :name="getStatusIcon(entry.status)"
                  class="h-4 w-4"
                  :class="getStatusIconClass(entry.status)"
                />

                <!-- Time -->
                <span class="text-muted-foreground">
                  {{ formatTime(entry.created_at) }}
                </span>

                <!-- Trigger Type Badge -->
                <span
                   class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                   :class="entry.trigger_type === 'auto'
                     ? 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-400'
                     : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'"
                 >
                  {{ entry.trigger_type }}
                </span>

                <!-- Items Count -->
                <span class="text-muted-foreground">
                  {{ entry.variables_synced + entry.secrets_synced }} item{{ (entry.variables_synced + entry.secrets_synced) !== 1 ? 's' : '' }}
                </span>
              </div>

              <!-- Expand Icon -->
              <Icon
                name="lucide:chevron-down"
                class="h-4 w-4 text-muted-foreground transition-transform"
                :class="expandedEntries.has(entry.id) && 'rotate-180'"
              />
            </button>

            <!-- Expanded Details -->
            <div
              v-if="expandedEntries.has(entry.id)"
              class="border-t px-3 py-2 text-xs space-y-2 bg-muted/20"
            >
              <!-- Variables/Secrets Breakdown -->
              <div class="flex gap-4">
                <span class="text-muted-foreground">
                  <Icon name="lucide:file-text" class="inline h-4 w-4 mr-1" />
                  {{ entry.variables_synced }} variable{{ entry.variables_synced !== 1 ? 's' : '' }}
                </span>
                <span class="text-muted-foreground">
                  <Icon name="lucide:lock" class="inline h-4 w-4 mr-1" />
                  {{ entry.secrets_synced }} secret{{ entry.secrets_synced !== 1 ? 's' : '' }}
                </span>
              </div>

              <!-- Variable Keys (if available in details) -->
              <div
                v-if="entry.details && (entry.details as DetailsWithKeys).keys"
                class="space-y-1"
              >
                <p class="font-medium text-muted-foreground">Synced keys:</p>
                <div class="flex flex-wrap gap-1">
                  <code
                    v-for="key in (entry.details as DetailsWithKeys).keys"
                    :key="key"
                    class="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]"
                  >
                    {{ key }}
                  </code>
                </div>
              </div>

              <!-- Error Message -->
              <div
                v-if="entry.error_message"
                class="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive"
              >
                <Icon name="lucide:alert-circle" class="h-4 w-4 shrink-0 mt-0.5" />
                <p>{{ entry.error_message }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Load More Button -->
      <div v-if="hasMore" class="flex justify-center pt-2">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          @click="$emit('loadMore')"
        >
          <Icon name="lucide:chevron-down" class="h-4 w-4" />
          Load more
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SyncHistoryEntry } from '~/types/integration.types'

interface DetailsWithKeys {
  keys?: string[]
}

interface Props {
  entries: SyncHistoryEntry[]
  loading?: boolean
  hasMore?: boolean
}

const props = defineProps<Props>()

defineEmits<{
  loadMore: []
}>()

// =====================================================
// State
// =====================================================

const expandedEntries = ref<Set<string>>(new Set())

// =====================================================
// Computed
// =====================================================

const groupedEntries = computed(() => {
  const groups: Record<string, SyncHistoryEntry[]> = {}

  for (const entry of props.entries) {
    const dateKey = getDateKey(entry.created_at)
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(entry)
  }

  return groups
})

// =====================================================
// Methods
// =====================================================

function toggleExpanded(id: string) {
  if (expandedEntries.value.has(id)) {
    expandedEntries.value.delete(id)
  } else {
    expandedEntries.value.add(id)
  }
}

function getDateKey(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (entryDate.getTime() === today.getTime()) {
    return 'Today'
  }
  if (entryDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'success': return 'lucide:check-circle'
    case 'partial': return 'lucide:alert-triangle'
    case 'failed': return 'lucide:x-circle'
    default: return 'lucide:circle'
  }
}

function getStatusIconClass(status: string): string {
   switch (status) {
     case 'success': return 'text-success-600 dark:text-success-400'
     case 'partial': return 'text-yellow-600 dark:text-yellow-400'
     case 'failed': return 'text-red-600 dark:text-red-400'
     default: return 'text-muted-foreground'
   }
 }
</script>
