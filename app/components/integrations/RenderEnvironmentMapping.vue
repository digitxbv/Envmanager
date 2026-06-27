<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <label class="block text-sm font-medium">Environment Mapping</label>
      <p class="text-xs text-muted-foreground">
        Select which EnvManager environments to sync to Render
      </p>
    </div>

    <!-- Mapping Table -->
    <div class="rounded-md border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="px-4 py-2 text-left font-medium">EnvManager Environment</th>
            <th class="px-4 py-2 text-left font-medium">Sync to Render</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr
            v-for="env in environments"
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
              <label class="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="isSelected(env.id)"
                  @change="toggle(env.id)"
                  class="rounded border-input h-4 w-4"
                />
                <span class="text-sm text-muted-foreground">
                  {{ isSelected(env.id) ? 'Enabled' : 'Disabled' }}
                </span>
              </label>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Help Text -->
    <p class="text-xs text-muted-foreground">
      <Icon name="lucide:info" class="inline h-4 w-4 mr-1" />
      Variables from selected environments will sync to your Render target.
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
// Methods
// =====================================================

function getEnvColor(envName: string): string {
  const normalizedName = envName.toLowerCase()
  return envColors[normalizedName] || '#6b7280'
}

function isSelected(envmanagerEnvId: string): boolean {
  return props.modelValue.some(m => m.envmanager_env === envmanagerEnvId)
}

function toggle(envmanagerEnvId: string) {
  const existingIndex = props.modelValue.findIndex(
    m => m.envmanager_env === envmanagerEnvId
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
      { envmanager_env: envmanagerEnvId }
    ]
  }

  emit('update:modelValue', newValue)
}
</script>
