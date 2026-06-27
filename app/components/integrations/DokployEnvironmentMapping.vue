<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <label class="block text-sm font-medium">Source Environment</label>
      <p class="text-xs text-muted-foreground">
        Select which EnvManager environment to sync
      </p>
    </div>

    <!-- Single Select Dropdown -->
    <select
      :value="selectedEnvId"
      @change="handleChange"
      class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
    >
      <option value="" disabled>Select an environment</option>
      <option
        v-for="env in environments"
        :key="env.id"
        :value="env.id"
      >
        {{ env.name }}
      </option>
    </select>

    <!-- Selected indicator -->
    <div v-if="selectedEnv" class="flex items-center gap-2 text-sm">
      <div
        class="h-2 w-2 rounded-full"
        :style="{ backgroundColor: getEnvColor(selectedEnv.name) }"
      />
      <span>Variables from <strong>{{ selectedEnv.name }}</strong> will sync to this Dokploy service</span>
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

interface EnvironmentMappingItem {
  envmanager_env: string
}

interface Props {
  environments: Environment[]
  modelValue: EnvironmentMappingItem[]
}

// =====================================================
// Props & Emits
// =====================================================

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: EnvironmentMappingItem[]]
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

const selectedEnvId = computed(() =>
  props.modelValue[0]?.envmanager_env ?? ''
)

const selectedEnv = computed(() =>
  props.environments.find(e => e.id === selectedEnvId.value)
)

// =====================================================
// Methods
// =====================================================

function getEnvColor(envName: string): string {
  const normalizedName = envName.toLowerCase()
  return envColors[normalizedName] || '#6b7280'
}

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const envId = target.value

  if (envId) {
    // Single selection - array with one item
    emit('update:modelValue', [{ envmanager_env: envId }])
  } else {
    emit('update:modelValue', [])
  }
}
</script>
