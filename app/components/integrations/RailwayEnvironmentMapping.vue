<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <label class="block text-sm font-medium">Environment Mapping</label>
      <p class="text-xs text-muted-foreground">
        Map your EnvManager environments to Railway environments
      </p>
    </div>

    <!-- Mapping Table -->
    <div class="rounded-md border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="px-4 py-2 text-left font-medium">EnvManager</th>
            <th class="px-4 py-2 text-left font-medium">Railway Environment(s)</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr
            v-for="env in envmanagerEnvironments"
            :key="env.id"
            class="hover:bg-muted/30 transition-colors"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <div
                  class="h-2 w-2 rounded-full"
                  :style="{ backgroundColor: getEnvColor(env.name) }"
                />
                <span class="font-medium">{{ env.name }}</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <!-- Multi-select checkboxes for Railway envs -->
              <div class="flex flex-wrap gap-3">
                <label
                  v-for="railwayEnv in railwayEnvironments"
                  :key="railwayEnv.id"
                  class="inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="isSelected(env.id, railwayEnv.id)"
                    @change="toggleMapping(env.id, railwayEnv.id, railwayEnv.name)"
                    class="rounded border-input"
                  />
                  <span class="text-sm" :class="getRailwayEnvClass(railwayEnv.name)">
                    {{ railwayEnv.name }}
                  </span>
                </label>
              </div>
              <div v-if="railwayEnvironments.length === 0" class="text-sm text-muted-foreground">
                No Railway environments available
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Help Text -->
    <p class="text-xs text-muted-foreground">
      <Icon name="lucide:info" class="inline h-4 w-4 mr-1" />
      Unchecked environments will not be synced. You can map one EnvManager env to multiple Railway envs.
    </p>
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

interface RailwayEnvironment {
  id: string
  name: string
}

interface EnvironmentMappingItem {
  envmanager_env: string
  railway_env_id: string
  railway_env_name: string
}

interface Props {
  envmanagerEnvironments: Environment[]
  railwayEnvironments: RailwayEnvironment[]
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

// Railway environment classes (color coding)
const railwayEnvClasses: Record<string, string> = {
  production: 'text-success-600 dark:text-success-400',
  prod: 'text-success-600 dark:text-success-400',
  staging: 'text-yellow-600 dark:text-yellow-400',
  stage: 'text-yellow-600 dark:text-yellow-400',
  development: 'text-info-600 dark:text-info-400',
  dev: 'text-info-600 dark:text-info-400',
  preview: 'text-orange-600 dark:text-orange-400',
  test: 'text-purple-600 dark:text-purple-400'
}

// =====================================================
// Methods
// =====================================================

function getEnvColor(envName: string): string {
  const normalizedName = envName.toLowerCase()
  return envColors[normalizedName] || '#6b7280'
}

function getRailwayEnvClass(envName: string): string {
  const normalizedName = envName.toLowerCase()
  return railwayEnvClasses[normalizedName] || ''
}

function isSelected(envmanagerEnvId: string, railwayEnvId: string): boolean {
  return props.modelValue.some(
    m => m.envmanager_env === envmanagerEnvId && m.railway_env_id === railwayEnvId
  )
}

function toggleMapping(envmanagerEnvId: string, railwayEnvId: string, railwayEnvName: string) {
  const existingIndex = props.modelValue.findIndex(
    m => m.envmanager_env === envmanagerEnvId && m.railway_env_id === railwayEnvId
  )

  let newValue: EnvironmentMappingItem[]

  if (existingIndex !== -1) {
    // Remove mapping
    newValue = [
      ...props.modelValue.slice(0, existingIndex),
      ...props.modelValue.slice(existingIndex + 1)
    ]
  } else {
    // Add mapping
    newValue = [
      ...props.modelValue,
      {
        envmanager_env: envmanagerEnvId,
        railway_env_id: railwayEnvId,
        railway_env_name: railwayEnvName
      }
    ]
  }

  emit('update:modelValue', newValue)
}
</script>
