<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <label class="block text-sm font-medium">Environments to Sync</label>
      <p class="text-xs text-muted-foreground">
        Variables from selected environments will be merged and synced
      </p>
    </div>

    <!-- Select All Checkbox -->
    <label class="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        :checked="allSelected"
        @change="toggleSelectAll"
        class="h-4 w-4 rounded border-input"
      />
      <span class="text-sm font-medium">Select All</span>
    </label>

    <!-- Environment Checkboxes -->
    <div class="space-y-2">
      <label
        v-for="env in environments"
        :key="env.id"
        class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30"
      >
        <input
          type="checkbox"
          :checked="isSelected(env.id)"
          @change="toggleEnvironment(env.id)"
          class="h-4 w-4 rounded border-input"
        />
        <div class="flex items-center gap-2">
          <div
            class="h-2 w-2 rounded-full"
            :style="{ backgroundColor: getEnvColor(env.name) }"
          />
          <span>{{ env.name }}</span>
        </div>
      </label>
    </div>

    <!-- Selected count -->
    <div v-if="selectedCount > 0" class="text-sm text-muted-foreground">
      {{ selectedCount }} {{ selectedCount === 1 ? 'environment' : 'environments' }} selected
    </div>
  </div>
</template>

<script setup lang="ts">

// =====================================================
// Types
// =====================================================

interface Environment {
  id: string
  name: string
}

interface Props {
  environments: Environment[]
  modelValue: string[]
}

// =====================================================
// Props & Emits
// =====================================================

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

// =====================================================
// Constants
// =====================================================

// Environment color mapping
const envColors: Record<string, string> = {
  production: '#22c55e',
  prod: '#22c55e',
  staging: '#eab308',
  stage: '#eab308',
  development: '#3b82f6',
  dev: '#3b82f6',
  preview: '#f97316',
  test: '#8b5cf6'
}

// =====================================================
// Computed
// =====================================================

const selectedCount = computed(() => props.modelValue.length)

const allSelected = computed(() => {
  return props.environments.length > 0 &&
         props.modelValue.length === props.environments.length
})

// =====================================================
// Methods
// =====================================================

function getEnvColor(envName: string): string {
  const normalizedName = envName.toLowerCase()
  return envColors[normalizedName] || '#6b7280'
}

function isSelected(envId: string): boolean {
  return props.modelValue.includes(envId)
}

function toggleEnvironment(envId: string) {
  const selected = [...props.modelValue]
  const index = selected.indexOf(envId)

  if (index > -1) {
    selected.splice(index, 1)
  } else {
    selected.push(envId)
  }

  emit('update:modelValue', selected)
}

function toggleSelectAll() {
  if (allSelected.value) {
    emit('update:modelValue', [])
  } else {
    emit('update:modelValue', props.environments.map(e => e.id))
  }
}
</script>
