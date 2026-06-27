<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"
      @click="$emit('cancel')"
    >
      <div
        class="bg-card rounded-lg shadow-lg border w-full max-w-md overflow-hidden"
        @click.stop
      >
        <div class="p-6 space-y-4">
          <!-- Header -->
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center h-10 w-10 rounded-full bg-warning/10 dark:bg-warning/20">
              <Icon name="lucide:alert-triangle" class="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 class="text-lg font-medium">Impact Analysis</h3>
              <p class="text-sm text-muted-foreground font-mono">{{ variableKey }}</p>
            </div>
          </div>

          <!-- Warning -->
          <p class="text-sm text-muted-foreground">
            This variable is referenced by <strong>{{ referencedBy.length }}</strong> variable{{ referencedBy.length > 1 ? 's' : '' }}:
          </p>

          <!-- Affected variables list -->
          <div class="max-h-48 overflow-y-auto space-y-2">
            <div
              v-for="ref in referencedBy"
              :key="ref.key"
              class="border rounded-lg p-2 text-sm"
            >
              <div class="font-mono font-medium">{{ ref.key }}</div>
              <div v-if="ref.environmentName" class="text-xs text-muted-foreground">
                {{ ref.environmentName }}
              </div>
              <div class="text-xs text-muted-foreground font-mono truncate mt-1">
                {{ ref.rawValue }}
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2 pt-2">
            <Button variant="outline" @click="$emit('cancel')">
              Cancel
            </Button>
            <Button variant="destructive" @click="$emit('proceed')">
              Proceed with change
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

defineProps<{
  open: boolean
  variableKey: string
  referencedBy: { key: string; environmentName: string; rawValue: string }[]
}>()

defineEmits<{
  proceed: []
  cancel: []
}>()
</script>
