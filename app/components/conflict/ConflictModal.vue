<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"
      @click="close"
    >
      <div
        class="bg-card rounded-lg shadow-lg border w-full max-w-lg overflow-hidden"
        @click.stop
      >
        <div class="p-6">
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <Icon name="lucide:alert-triangle" class="h-5 w-5 text-warning" />
              <h3 class="text-lg font-medium">Conflict Detected</h3>
            </div>
            <button
              @click="close"
              class="text-muted-foreground hover:text-foreground"
            >
              <Icon name="lucide:x" class="h-5 w-5" />
            </button>
          </div>

          <!-- Description -->
          <p class="text-sm text-muted-foreground mb-4">
            The variable <span class="font-medium text-foreground">{{ conflictData?.variableKey }}</span>
            was modified by <span class="font-medium text-foreground">{{ conflictData?.theirEmail }}</span>
            while you were editing.
          </p>

          <!-- Comparison -->
          <div class="space-y-4 mb-6">
            <!-- Their version -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">Current value (theirs)</span>
                <span class="text-xs text-muted-foreground">{{ formatDate(conflictData?.theirUpdatedAt) }}</span>
              </div>
              <div class="bg-muted rounded-md p-3">
                <pre class="text-sm font-mono whitespace-pre-wrap break-all">{{ conflictData?.theirValue }}</pre>
              </div>
            </div>

            <!-- Your version -->
            <div class="space-y-2">
              <span class="text-sm font-medium">Your changes</span>
              <div class="bg-muted rounded-md p-3 border-2 border-primary/30">
                <pre class="text-sm font-mono whitespace-pre-wrap break-all">{{ conflictData?.myValue }}</pre>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="close">
              Cancel
            </Button>
            <Button variant="outline" @click="useTheirs">
              Keep Theirs
            </Button>
            <Button @click="useMine">
              Use Mine
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

export interface ConflictData {
  variableKey: string
  myValue: string
  theirValue: string
  theirEmail: string
  theirUpdatedAt: string
}

const props = defineProps<{
  modelValue: boolean
  conflictData: ConflictData | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'use-mine'): void
  (e: 'use-theirs'): void
}>()

function close() {
  emit('update:modelValue', false)
}

function useMine() {
  emit('use-mine')
}

function useTheirs() {
  emit('use-theirs')
}

function formatDate(dateString: string | undefined) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString()
}
</script>
