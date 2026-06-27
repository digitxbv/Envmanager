<template>
  <Teleport to="body">
    <div
      v-if="modelValue && request"
      class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
      @click="close"
    >
      <div
        class="bg-card border rounded-lg shadow-lg max-w-md w-full mx-4 p-6"
        @click.stop
      >
        <!-- Header -->
        <h3 class="text-lg font-semibold mb-4">Deny Access Request</h3>

        <!-- Request Summary Card -->
        <div class="bg-muted rounded-lg p-4 mb-4 space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Requester:</span>
            <span class="font-medium">{{ request.requester_email }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Secret:</span>
            <span class="font-mono">{{ request.variable_key }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Reason:</span>
            <span class="text-right max-w-[200px]">{{ request.request_reason }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Requested:</span>
            <span>{{ formatRelativeTime(request.requested_at) }}</span>
          </div>
        </div>

        <!-- Denial Reason Textarea -->
        <div class="mb-4">
          <textarea
            v-model="denialReason"
            placeholder="Reason for denying (optional)"
            class="w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            rows="3"
          />
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2">
          <Button
            variant="outline"
            :disabled="isLoading"
            @click="close"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            :loading="isLoading"
            @click="handleDeny"
          >
            Deny Access
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

interface EnrichedRequest {
  id: string
  variable_id: string
  environment_id: string
  organization_id: string
  requested_by: string
  requested_at: string
  request_reason: string
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'revoked'
  reviewed_by: string | null
  reviewed_at: string | null
  denial_reason: string | null
  access_duration_minutes: number | null
  access_expires_at: string | null
  reveal_count: number
  max_reveals: number
  requester_email: string
  variable_key: string
}

interface Props {
  modelValue: boolean
  request: EnrichedRequest | null
  denyFn: (grantId: string, reason?: string) => Promise<boolean>
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'denied'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { $toast } = useNuxtApp()

const denialReason = ref('')
const isLoading = ref(false)

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMin = Math.floor((now - then) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function close() {
  emit('update:modelValue', false)
  resetForm()
}

function resetForm() {
  denialReason.value = ''
  isLoading.value = false
}

async function handleDeny() {
  if (!props.request) return

  isLoading.value = true

  try {
    const success = await props.denyFn(
      props.request.id,
      denialReason.value.trim() || undefined
    )

    if (success) {
      $toast.success('Access request denied')
      emit('denied')
      close()
    } else {
      $toast.error('Failed to deny request')
    }
  } catch {
    $toast.error('Failed to deny request')
  } finally {
    isLoading.value = false
  }
}

// Reset form when modal closes
watch(() => props.modelValue, (isOpen) => {
  if (!isOpen) {
    resetForm()
  }
})
</script>
