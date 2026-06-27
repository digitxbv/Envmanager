<template>
  <div v-if="services.length > 0" class="space-y-2">
    <label class="block text-sm font-medium">Service scope</label>
    <select
      :value="modelValue ?? ''"
      :disabled="disabled"
      class="w-full rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed"
      @change="handleChange"
    >
      <option value="">All variables (default)</option>
      <option
        v-for="service in services"
        :key="service.id"
        :value="service.id"
      >
        {{ service.name }}
      </option>
    </select>
    <p class="text-xs text-muted-foreground">
      Limit sync to variables from a specific service, or sync all variables.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { Database } from '~/types/database.types'

type ServiceRow = Database['public']['Tables']['services']['Row']

interface Props {
  modelValue: string | null
  services: readonly ServiceRow[]
  disabled?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

function handleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update:modelValue', value || null)
}
</script>
