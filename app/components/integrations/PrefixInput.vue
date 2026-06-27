<template>
  <div class="space-y-2">
    <div class="relative">
      <Input
        :model-value="displayValue"
        @update:modelValue="handleInput"
        placeholder="e.g., STAGING"
        class="uppercase"
        type="text"
      />
    </div>

    <div v-if="displayValue" class="text-sm text-muted-foreground">
      <span>Preview: </span>
      <code class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
        DATABASE_URL
      </code>
      <span> will sync as </span>
      <code class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
        {{ displayValue }}_DATABASE_URL
      </code>
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from '~/components/ui/Input.vue'

const props = defineProps<{
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const displayValue = computed(() => props.modelValue || '')

function handleInput(value: string) {
  // Convert to uppercase and filter to A-Z, 0-9 only
  const sanitized = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  // Emit null for empty string, otherwise emit the sanitized value
  emit('update:modelValue', sanitized === '' ? null : sanitized)
}
</script>
