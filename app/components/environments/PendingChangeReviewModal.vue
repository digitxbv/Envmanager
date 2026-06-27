<template>
  <Teleport to="body">
    <div
      v-if="isOpen && change"
      class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      @click="emit('close')"
    >
      <div
        class="bg-card rounded-lg shadow-lg border w-full max-w-lg p-6"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold">
              {{ mode === 'approve' ? 'Approve Change' : 'Reject Change' }}
            </h3>
            <p class="text-sm text-muted-foreground mt-1">
              Review the proposed change below
            </p>
          </div>
          <button
            class="text-muted-foreground hover:text-foreground transition-colors"
            @click="emit('close')"
            aria-label="Close modal"
          >
            <Icon name="lucide:x" class="h-5 w-5" />
          </button>
        </div>

        <!-- Change Summary Card -->
        <div class="bg-muted/50 rounded-lg p-4 mb-4">
          <div class="flex items-center gap-2 mb-3">
            <span
              :class="[
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                actionBadgeClass
              ]"
            >
              {{ actionLabel }}
            </span>
            <code class="text-sm font-mono bg-muted px-2 py-0.5 rounded">
              {{ change.variable_key }}
            </code>
          </div>

          <!-- Diff view based on action -->
          <div class="space-y-2">
            <!-- Create: Show new value -->
            <div v-if="change.action === 'create'" class="bg-success/10 border border-success/30 rounded p-2">
              <code class="text-sm font-mono text-success">
                {{ change.variable_key }} = {{ displayValue(change.variable_value, change.is_secret) }}
              </code>
            </div>

            <!-- Update: Show old and new values -->
            <template v-else-if="change.action === 'update'">
              <div class="bg-destructive/10 border border-destructive/30 rounded p-2">
                <code class="text-sm font-mono text-destructive">
                  - {{ displayValue(change.old_value, change.is_secret) }}
                </code>
              </div>
              <div class="bg-success/10 border border-success/30 rounded p-2">
                <code class="text-sm font-mono text-success">
                  + {{ displayValue(change.variable_value, change.is_secret) }}
                </code>
              </div>
            </template>

            <div v-else-if="change.action === 'delete'" class="bg-destructive/10 border border-destructive/30 rounded p-2">
              <code class="text-sm font-mono text-destructive">
                Deleting: {{ change.variable_key }}
              </code>
            </div>
          </div>
        </div>

        <!-- Request Details -->
        <div class="space-y-2 mb-4 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Requested by:</span>
            <span class="font-medium">{{ change.requester_email || change.requested_by }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Requested:</span>
            <span>{{ formatDate(change.requested_at) }}</span>
          </div>
          <div v-if="change.comment" class="flex justify-between">
            <span class="text-muted-foreground">Comment:</span>
            <span class="text-right max-w-[60%]">{{ change.comment }}</span>
          </div>
          <div v-if="change.expires_at" class="flex justify-between">
            <span class="text-muted-foreground">Expires:</span>
            <span>{{ formatDate(change.expires_at) }}</span>
          </div>
          <div v-if="change.first_approver_email && isTwoPersonPending === false" class="flex justify-between">
            <span class="text-muted-foreground">First approval by:</span>
            <span class="font-medium">{{ change.first_approver_email }}</span>
          </div>
        </div>

        <!-- Conflict Warning -->
        <div
          v-if="hasConflict"
          class="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4"
        >
          <Icon name="lucide:alert-triangle" class="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p class="font-medium text-amber-600 dark:text-amber-400">Variable has been modified</p>
            <p class="text-sm text-muted-foreground mt-1">
              The variable was changed after this request was submitted. Review carefully.
            </p>
          </div>
        </div>

        <!-- Rejection Reason (only for reject mode) -->
        <div v-if="mode === 'reject'" class="mb-4">
          <label class="block text-sm font-medium mb-2">
            Reason for rejection (optional)
          </label>
          <textarea
            v-model="rejectionReason"
            rows="3"
            class="w-full px-3 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder="Explain why this change is being rejected..."
          />
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            @click="emit('close')"
            :disabled="isLoading"
          >
            Cancel
          </Button>
           <Button
             v-if="mode === 'approve'"
             variant="success"
             @click="handleConfirm"
             :loading="isLoading"
           >
             {{ isTwoPersonPending ? 'Add First Approval' : 'Approve & Apply' }}
           </Button>
          <Button
            v-else
            variant="destructive"
            @click="handleConfirm"
            :loading="isLoading"
          >
            Reject Change
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import type { PendingChange } from '~/composables/usePendingChanges'

interface Props {
  isOpen: boolean
  change: PendingChange | null
  mode: 'approve' | 'reject'
  isTwoPersonPending?: boolean // true if two_person mode and no first_approver yet
  hasConflict?: boolean // true if variable was modified after request
}

interface Emits {
  (e: 'close'): void
  (e: 'confirm', reason?: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const rejectionReason = ref('')
const isLoading = ref(false)

// Reset rejection reason when modal closes or change changes
watch(() => props.isOpen, (open) => {
  if (!open) {
    rejectionReason.value = ''
    isLoading.value = false
  }
})

// Computed: Action badge styling
const actionBadgeClass = computed(() => {
  switch (props.change?.action) {
    case 'create':
      return 'bg-success/10 text-success'
    case 'update':
      return 'bg-info/10 text-info'
    case 'delete':
      return 'bg-destructive/10 text-destructive'
    default:
      return 'bg-muted text-muted-foreground'
  }
})

// Computed: Action label
const actionLabel = computed(() => {
  switch (props.change?.action) {
    case 'create':
      return 'Create'
    case 'update':
      return 'Update'
    case 'delete':
      return 'Delete'
    default:
      return 'Unknown'
  }
})

// Display value (mask secrets)
const displayValue = (value: string | null, isSecret: boolean): string => {
  if (!value) return '(empty)'
  if (isSecret) return '••••••••'
  return value
}

// Format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Handle confirm action
const handleConfirm = () => {
  isLoading.value = true
  if (props.mode === 'reject') {
    emit('confirm', rejectionReason.value || undefined)
  } else {
    emit('confirm')
  }
}
</script>
