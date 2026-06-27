<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      @click="close"
    >
      <div
        class="bg-card rounded-lg shadow-lg border w-full max-w-md p-6"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold">Request Access to Secret</h3>
            <p class="text-sm text-muted-foreground mt-1">
              Request temporary access to view <span class="font-medium">{{ variableName }}</span>. An admin will review your request.
            </p>
          </div>
          <button
            class="text-muted-foreground hover:text-foreground transition-colors"
            @click="close"
            aria-label="Close modal"
          >
            <Icon name="lucide:x" class="h-5 w-5" />
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Reason textarea -->
          <div>
            <label for="reason" class="block text-sm font-medium mb-1">
              Reason for access <span class="text-destructive">*</span>
            </label>
            <textarea
              id="reason"
              v-model="reason"
              rows="4"
              required
              minlength="20"
              placeholder="Explain why you need access to this secret..."
              class="w-full px-3 py-2 border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
            <p class="text-xs text-muted-foreground mt-1">
              {{ reason.length }}/20 minimum
            </p>
          </div>

          <!-- Ticket reference -->
          <div>
            <label for="ticket" class="block text-sm font-medium mb-1">
              Ticket Reference <span class="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="ticket"
              v-model="ticket"
              type="text"
              placeholder="JIRA-123 or GitHub issue URL"
              class="w-full px-3 py-2 border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <!-- Error display -->
          <div
            v-if="error"
            class="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm"
          >
            {{ error }}
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              @click="close"
              :disabled="loading"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              :loading="loading"
              :disabled="reason.length < 20"
            >
              Request Access
            </Button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

interface Props {
  modelValue: boolean
  variableName: string
  requestFn: (reason: string) => Promise<{ success: boolean; error?: string }>
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'requested'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { $toast } = useNuxtApp()

const reason = ref('')
const ticket = ref('')
const loading = ref(false)
const error = ref('')

const close = () => {
  if (loading.value) return
  resetForm()
  emit('update:modelValue', false)
}

const resetForm = () => {
  reason.value = ''
  ticket.value = ''
  error.value = ''
}

const handleSubmit = async () => {
  if (reason.value.length < 20) return

  loading.value = true
  error.value = ''

  try {
    const finalReason = ticket.value
      ? `${reason.value}\n\nRef: ${ticket.value}`
      : reason.value

    const result = await props.requestFn(finalReason)

    if (result.success) {
      $toast.success('Access request submitted. An admin will review your request.')
      emit('requested')
      resetForm()
      emit('update:modelValue', false)
    } else {
      error.value = result.error || 'Failed to submit access request'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

// Reset form when modal closes
watch(() => props.modelValue, (isOpen) => {
  if (!isOpen) {
    resetForm()
  }
})
</script>
