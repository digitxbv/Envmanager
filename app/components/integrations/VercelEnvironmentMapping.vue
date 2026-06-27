<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <label class="block text-sm font-medium">Environment Mapping</label>
      <p class="text-xs text-muted-foreground">
        Map your EnvManager environments to Vercel targets
      </p>
    </div>

    <!-- Mapping Table -->
    <div class="rounded-md border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="px-4 py-2 text-left font-medium">EnvManager</th>
            <th class="px-4 py-2 text-left font-medium">Vercel Target(s)</th>
            <th class="px-4 py-2 text-left font-medium">Git Branch Filter</th>
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
              <div class="flex flex-wrap gap-2">
                <!-- Vercel target checkboxes -->
                <label
                  v-for="target in vercelTargets"
                  :key="target.id"
                  class="inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="isTargetSelected(env.id, target.id)"
                    @change="toggleTarget(env.id, target.id)"
                    class="rounded border-input"
                  />
                  <span class="text-sm" :class="target.class">
                    {{ target.label }}
                  </span>
                </label>
              </div>
            </td>
            <td class="px-4 py-3">
              <!-- Git branch filter input (VERC-05) - only show when preview is selected -->
              <div v-if="hasPreviewTarget(env.id)" class="flex items-center gap-2">
                <Input
                  :model-value="getGitBranch(env.id)"
                  @update:model-value="setGitBranch(env.id, $event)"
                  placeholder="e.g., develop, feature/*"
                  class-name="h-8 text-xs w-40"
                />
                <span class="text-muted-foreground" title="Optional: Filter preview deployments to specific git branch. Leave empty to sync to all preview deployments.">
                  <Icon name="lucide:info" class="h-4 w-4" />
                </span>
              </div>
              <span v-else class="text-xs text-muted-foreground">
                N/A
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Help Text -->
    <p class="text-xs text-muted-foreground">
      <Icon name="lucide:info" class="inline h-4 w-4 mr-1" />
      Unchecked environments will not be synced. For preview deployments, optionally specify a git branch filter.
    </p>
  </div>
</template>

<script setup lang="ts">
import Input from '~/components/ui/Input.vue'

interface Environment {
  id: string
  name: string
}

interface EnvironmentMappingItem {
  envmanager_env: string
  vercel_targets: ('production' | 'preview' | 'development')[]
  git_branch?: string  // VERC-05: Git branch filter for preview
}

interface Props {
  environments: Environment[]
  modelValue: EnvironmentMappingItem[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: EnvironmentMappingItem[]]
}>()

// =====================================================
// Constants
// =====================================================

const vercelTargets = [
   { id: 'production', label: 'Production', class: 'text-success-600 dark:text-success-400' },
   { id: 'preview', label: 'Preview', class: 'text-yellow-600 dark:text-yellow-400' },
   { id: 'development', label: 'Development', class: 'text-info-600 dark:text-info-400' }
 ] as const

const envColors: Record<string, string> = {
  production: '#22c55e',
  staging: '#eab308',
  development: '#3b82f6',
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

function isTargetSelected(envId: string, targetId: string): boolean {
  const mapping = props.modelValue.find(m => m.envmanager_env === envId)
  return mapping?.vercel_targets.includes(targetId as 'production' | 'preview' | 'development') || false
}

function hasPreviewTarget(envId: string): boolean {
  return isTargetSelected(envId, 'preview')
}

function getGitBranch(envId: string): string {
  const mapping = props.modelValue.find(m => m.envmanager_env === envId)
  return mapping?.git_branch || ''
}

function setGitBranch(envId: string, value: string) {
  const newValue = [...props.modelValue]
  const mapping = newValue.find(m => m.envmanager_env === envId)

  if (mapping) {
    mapping.git_branch = value || undefined  // Remove if empty
  }

  emit('update:modelValue', newValue)
}

function toggleTarget(envId: string, targetId: string) {
  const newValue = [...props.modelValue]
  let mapping = newValue.find(m => m.envmanager_env === envId)

  if (!mapping) {
    // Create new mapping
    mapping = { envmanager_env: envId, vercel_targets: [] }
    newValue.push(mapping)
  }

  const targetIndex = mapping.vercel_targets.indexOf(targetId as 'production' | 'preview' | 'development')
  if (targetIndex === -1) {
    // Add target
    mapping.vercel_targets.push(targetId as 'production' | 'preview' | 'development')
  } else {
    // Remove target
    mapping.vercel_targets.splice(targetIndex, 1)
    // Clear git_branch if preview is being removed
    if (targetId === 'preview') {
      mapping.git_branch = undefined
    }
  }

  // Clean up empty mappings
  const filteredValue = newValue.filter(m => m.vercel_targets.length > 0)
  emit('update:modelValue', filteredValue)
}
</script>
