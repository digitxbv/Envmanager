<template>
  <div class="flex items-start gap-3 rounded-lg border p-3">
    <!-- Variable selector -->
    <div class="flex-1 min-w-0">
      <label class="block text-xs font-medium text-muted-foreground mb-1">Variable</label>
      <select
        :value="modelValue.variable_id"
        class="w-full rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @change="updateField('variable_id', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">Select a secret variable...</option>
        <option
          v-for="v in variables"
          :key="v.id"
          :value="v.id"
        >
          {{ v.key }}
        </option>
      </select>
    </div>

    <!-- Inject as -->
    <div class="w-28 shrink-0">
      <label class="block text-xs font-medium text-muted-foreground mb-1">Inject as</label>
      <select
        :value="modelValue.inject_as"
        class="w-full rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @change="updateField('inject_as', ($event.target as HTMLSelectElement).value)"
      >
        <option value="header">Header</option>
        <option value="body">Body</option>
        <option value="query">Query</option>
      </select>
    </div>

    <!-- Key -->
    <div class="flex-1 min-w-0">
      <label class="block text-xs font-medium text-muted-foreground mb-1">Key</label>
      <input
        type="text"
        :value="modelValue.key"
        placeholder="e.g. Authorization"
        class="flex h-9 w-full rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @input="updateField('key', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Template -->
    <div class="flex-1 min-w-0">
      <label class="block text-xs font-medium text-muted-foreground mb-1">Template</label>
      <input
        type="text"
        :value="modelValue.template || ''"
        placeholder="e.g. Bearer ${value}"
        class="flex h-9 w-full rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @input="updateField('template', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Remove button -->
    <div class="pt-5">
      <button
        type="button"
        class="text-muted-foreground hover:text-destructive transition-colors"
        title="Remove mapping"
        @click="$emit('remove')"
      >
        <Icon name="lucide:trash-2" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SecretMapping } from '~/types/proxy.types'

interface VariableOption {
  id: string
  key: string
}

interface Props {
  modelValue: SecretMapping
  variables: VariableOption[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: SecretMapping]
  'remove': []
}>()

function updateField(field: keyof SecretMapping, value: string) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>
