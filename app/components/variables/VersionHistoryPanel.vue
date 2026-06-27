<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 bg-background/80 z-50 flex justify-end"
      @click="$emit('close')"
    >
      <div
        class="bg-card border-l shadow-lg w-full max-w-[480px] h-full flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b">
          <div>
            <h3 class="text-lg font-medium">Version History</h3>
            <p class="text-sm text-muted-foreground font-mono">{{ variableKey }}</p>
          </div>
          <Button variant="ghost" size="icon" @click="$emit('close')">
            <Icon name="lucide:x" class="h-4 w-4" />
          </Button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <!-- Loading -->
          <div v-if="loading && history.length === 0" class="flex items-center justify-center py-8">
            <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
          </div>

          <!-- Empty state -->
          <div v-else-if="history.length === 0" class="text-center py-8 text-muted-foreground">
            <Icon name="lucide:history" class="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No history available</p>
          </div>

          <!-- History entries -->
          <div
            v-for="(entry, index) in history"
            :key="entry.id"
            class="border rounded-lg p-3"
            :class="{ 'border-primary/50 bg-primary/5': index === 0 }"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted">
                  v{{ entry.version_number }}
                </span>
                <span
                  class="text-xs font-medium"
                  :class="{
                    'text-success': entry.action === 'created',
                    'text-blue-600': entry.action === 'updated',
                    'text-destructive': entry.action === 'deleted'
                  }"
                >
                  {{ entry.action }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <Button
                  v-if="index > 0 && !isSecret && entry.action !== 'deleted'"
                  variant="ghost"
                  size="sm"
                  class="h-7 text-xs"
                  @click="startRollback(entry)"
                >
                  <Icon name="lucide:undo-2" class="h-3 w-3 mr-1" />
                  Rollback
                </Button>
              </div>
            </div>

            <!-- Value diff (non-secret only) -->
            <div v-if="!isSecret && entry.action === 'updated'" class="mt-2 text-xs font-mono">
              <div class="text-destructive/70 line-through truncate">{{ entry.old_value }}</div>
              <div class="text-success truncate">{{ entry.new_value }}</div>
            </div>
            <div v-else-if="!isSecret && entry.action === 'created'" class="mt-2 text-xs font-mono text-success truncate">
              {{ entry.new_value }}
            </div>
            <div v-else-if="isSecret" class="mt-2 text-xs text-muted-foreground italic">
              [encrypted]
            </div>

            <!-- Reason -->
            <div v-if="entry.change_reason" class="mt-1 text-xs text-muted-foreground italic">
              "{{ entry.change_reason }}"
            </div>

            <!-- Meta -->
            <div class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{{ entry.user_email }}</span>
              <span>&middot;</span>
              <span>{{ formatRelativeTime(entry.created_at) }}</span>
            </div>
          </div>

          <!-- Load more -->
          <div v-if="hasMore" class="pt-2">
            <Button
              variant="outline"
              size="sm"
              class="w-full"
              :loading="loading"
              @click="loadMore"
            >
              Load more
            </Button>
          </div>
        </div>

        <!-- Rollback Confirmation -->
        <div v-if="rollbackTarget" class="border-t p-4 bg-muted/30">
          <h4 class="text-sm font-medium mb-2">
            Rollback to v{{ rollbackTarget.version_number }}
          </h4>
           <p v-if="isProtected" class="text-xs text-warning mb-2">
            This environment is protected. The rollback will be submitted for approval.
          </p>
          <textarea
            v-model="rollbackReason"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm mb-2 resize-none"
            rows="2"
            placeholder="Reason for rollback (optional)"
          />
          <div class="flex justify-end gap-2">
            <Button variant="outline" size="sm" @click="rollbackTarget = null">
              Cancel
            </Button>
            <Button
              size="sm"
              :loading="rollbackLoading"
              @click="confirmRollback"
            >
              {{ isProtected ? 'Submit for approval' : 'Rollback' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

const props = defineProps<{
  open: boolean
  variableId: string
  variableKey: string
  isSecret: boolean
  isProtected: boolean
}>()

const emit = defineEmits<{
  close: []
  rollback: []
}>()

const { $toast } = useNuxtApp()
const { history, loading, hasMore, getHistory, rollbackToVersion, reset } = useVariableHistory()

const rollbackTarget = ref<any>(null)
const rollbackReason = ref('')
const rollbackLoading = ref(false)
const page = ref(0)
const PAGE_SIZE = 20

// Load history when panel opens
watch(() => props.open, async (isOpen) => {
  if (isOpen && props.variableId) {
    reset()
    page.value = 0
    await getHistory(props.variableId, PAGE_SIZE, 0)
  }
})

async function loadMore() {
  page.value++
  await getHistory(props.variableId, PAGE_SIZE, page.value * PAGE_SIZE)
}

function startRollback(entry: any) {
  rollbackTarget.value = entry
  rollbackReason.value = ''
}

async function confirmRollback() {
  if (!rollbackTarget.value) return
  rollbackLoading.value = true

  try {
    const result = await rollbackToVersion(
      props.variableId,
      rollbackTarget.value.version_number,
      rollbackReason.value || 'Rolled back to v' + rollbackTarget.value.version_number
    )

    if (result.pending_change_id) {
      $toast.success('Rollback submitted for approval')
    } else {
      $toast.success(`Rolled back to v${rollbackTarget.value.version_number}`)
    }

    rollbackTarget.value = null
    // Refresh history and notify parent
    reset()
    page.value = 0
    await getHistory(props.variableId, PAGE_SIZE, 0)
    emit('rollback')
  } catch (e: any) {
    $toast.error(e.message || 'Rollback failed')
  } finally {
    rollbackLoading.value = false
  }
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
</script>
