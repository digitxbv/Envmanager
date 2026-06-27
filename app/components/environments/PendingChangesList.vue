<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 class="text-lg font-semibold">Pending Changes</h3>
        <span
          v-if="filteredChanges.length > 0"
          class="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full px-2.5 py-0.5 text-xs font-medium"
        >
          {{ filteredChanges.length }}
        </span>
      </div>

      <!-- Status Filter -->
      <select
        v-model="statusFilter"
        class="text-sm border rounded-md px-2 py-1 bg-background"
      >
        <option value="all">All</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="expired">Expired</option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredChanges.length === 0"
      class="text-center py-8 text-muted-foreground"
    >
      <Icon name="lucide:clock" class="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>No {{ statusFilter === 'all' ? '' : statusFilter }} changes</p>
    </div>

    <!-- Change List -->
    <div v-else class="space-y-3">
      <div
        v-for="change in filteredChanges"
        :key="change.id"
        class="border rounded-lg p-4"
      >
        <!-- Project / Environment context -->
        <div
          v-if="showContext && (change.project_name || change.environment_name)"
          class="text-xs text-muted-foreground mb-2 flex items-center gap-1"
        >
          <Icon name="lucide:folder" class="h-3 w-3" />
          <span class="font-medium">{{ change.project_name }}</span>
          <Icon name="lucide:chevron-right" class="h-3 w-3" />
          <span>{{ change.environment_name }}</span>
        </div>

        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <!-- Action Badge + Variable Key -->
            <div class="flex items-center gap-2 mb-2">
              <span :class="actionBadgeClass(change.action)">
                {{ change.action }}
              </span>
              <code class="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                {{ change.variable_key }}
              </code>
            </div>

            <!-- Diff View (for updates with old_value) -->
             <div
               v-if="change.action === 'update' && change.old_value"
               class="text-sm font-mono space-y-1 my-2"
             >
               <div class="text-destructive bg-destructive/10 px-2 py-1 rounded">
                 - {{ maskValue(change.old_value, change.is_secret) }}
               </div>
               <div class="text-success bg-success/10 px-2 py-1 rounded">
                 + {{ maskValue(change.variable_value, change.is_secret) }}
               </div>
             </div>

            <!-- Metadata -->
            <p class="text-sm text-muted-foreground">
              Requested by {{ change.requester_email || 'Unknown' }}
              {{ formatRelative(change.requested_at) }}
              <span v-if="change.comment" class="italic">
                - "{{ change.comment }}"
              </span>
            </p>

            <!-- Two-person approval status -->
            <p
              v-if="change.first_approver && change.status === 'pending'"
              class="text-sm text-amber-600 dark:text-amber-400 mt-1"
            >
              First approval by {{ change.first_approver_email || 'a team member' }}. Needs second approver.
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <template v-if="change.status === 'pending'">
              <template v-if="canApprove">
                <Button
                  variant="outline"
                  size="sm"
                  @click="$emit('reject', change)"
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  @click="$emit('approve', change)"
                >
                  Approve
                </Button>
              </template>
              <Button
                v-if="change.requested_by === currentUserId"
                variant="ghost"
                size="sm"
                @click="$emit('cancel', change.id)"
              >
                Cancel
              </Button>
            </template>

            <!-- Status Badge (non-pending) -->
            <span
              v-else
              :class="statusBadgeClass(change.status)"
            >
              {{ change.status }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import type { PendingChange } from '@/composables/usePendingChanges'

const props = defineProps<{
  changes: PendingChange[]
  currentUserId: string
  isLoading?: boolean
  showContext?: boolean
  canApprove?: boolean
}>()

defineEmits<{
  'approve': [change: PendingChange]
  'reject': [change: PendingChange]
  'cancel': [changeId: string]
}>()

const statusFilter = ref<'all' | 'pending' | 'approved' | 'rejected' | 'expired'>('pending')

const filteredChanges = computed(() => {
  if (statusFilter.value === 'all') return props.changes
  return props.changes.filter(c => c.status === statusFilter.value)
})

const maskValue = (value: string | null, isSecret: boolean): string => {
  if (!value) return ''
  if (isSecret) return '••••••••'
  if (value.length > 40) return value.substring(0, 40) + '...'
  return value
}

const formatRelative = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  return date.toLocaleDateString()
}

const actionBadgeClass = (action: string): string => {
  const base = 'text-xs font-medium px-2 py-0.5 rounded-full'
  switch (action) {
    case 'create':
      return `${base} bg-success/10 text-success`
    case 'update':
      return `${base} bg-info/10 text-info`
    case 'delete':
      return `${base} bg-destructive/10 text-destructive`
    default:
      return `${base} bg-muted text-muted-foreground`
  }
}

const statusBadgeClass = (status: string): string => {
  const base = 'text-xs font-medium px-2 py-0.5 rounded-full'
  switch (status) {
    case 'approved':
      return `${base} bg-success/10 text-success`
    case 'rejected':
      return `${base} bg-destructive/10 text-destructive`
    case 'expired':
    case 'cancelled':
      return `${base} bg-muted text-muted-foreground`
    default:
      return `${base} bg-warning/10 text-warning`
  }
}
</script>
