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
        <h3 class="text-lg font-semibold mb-4">Grant Access</h3>

        <!-- Request Summary Card -->
        <div class="bg-muted rounded-lg p-4 mb-6 space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Requester:</span>
            <span class="font-medium">{{ request.requester_email }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Secret:</span>
            <span class="font-mono text-xs bg-background px-2 py-0.5 rounded">{{ request.variable_key }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Reason:</span>
            <span class="text-right max-w-[200px]">{{ request.request_reason }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Requested:</span>
            <span>{{ formatRelativeTime(request.requested_at) }}</span>
          </div>
        </div>

        <!-- Duration Selector -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Access Duration</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="option in durationOptions"
              :key="option.value"
              type="button"
              class="px-3 py-2 text-sm border rounded-md transition-colors"
              :class="[
                selectedDuration === option.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input hover:bg-muted'
              ]"
              @click="selectedDuration = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <!-- Info Text -->
        <p class="text-sm text-muted-foreground mb-6">
          Access will expire {{ formatDuration(selectedDuration) }} after approval.
        </p>

        <!-- Footer -->
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="close" :disabled="isSubmitting">
            Cancel
          </Button>
          <Button @click="handleApprove" :loading="isSubmitting">
            Grant Access
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
  approveFn: (grantId: string, duration: number) => Promise<boolean>
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'granted'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { $toast } = useNuxtApp()

const durationOptions = [
  { label: '15 min', value: 15 },
  { label: '1 hour', value: 60 },
  { label: '4 hours', value: 240 },
  { label: '8 hours', value: 480 },
  { label: '24 hours', value: 1440 }
]

const selectedDuration = ref(60)
const isSubmitting = ref(false)

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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`
  const hours = minutes / 60
  return hours === 1 ? '1 hour' : `${hours} hours`
}

function close() {
  emit('update:modelValue', false)
}

// Reset selectedDuration when modal closes
watch(() => props.modelValue, (isOpen) => {
  if (!isOpen) {
    selectedDuration.value = 60
  }
})

async function handleApprove() {
  if (!props.request) return

  isSubmitting.value = true
  try {
    const success = await props.approveFn(props.request.id, selectedDuration.value)
    if (success) {
      $toast.success('Access granted')
      emit('granted')
      close()
    } else {
      $toast.error('Failed to grant access')
    }
  } catch {
    $toast.error('Failed to grant access')
  } finally {
    isSubmitting.value = false
  }
}
</script>
