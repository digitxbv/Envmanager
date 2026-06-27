<template>
  <Dialog
    :open="Boolean(member)"
    max-width="lg"
    title="Manage Environment Access"
    :description="member ? `Managing access for: ${member.email}` : ''"
    @close="emit('close')"
  >
    <div v-if="member">
      <!-- Environment List (Grouped by Project) -->
      <div class="my-2">
        <div v-if="environments.length === 0" class="text-center py-8 text-muted-foreground">
          <Icon name="lucide:inbox" class="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No environments available</p>
        </div>

        <div v-else class="space-y-4 max-h-96 overflow-y-auto pr-1">
          <!-- Group environments by project -->
          <div
            v-for="(projectEnvs, projectName) in environmentsByProject"
            :key="projectName"
            class="rounded-lg border border-border overflow-hidden"
          >
            <!-- Project Header -->
            <div class="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
              <Icon name="lucide:folder" class="h-4 w-4 text-muted-foreground" />
              <span class="text-sm font-semibold text-foreground">{{ projectName }}</span>
              <span class="text-xs text-muted-foreground">({{ projectEnvs.length }} environments)</span>
            </div>

            <!-- Environments in this project -->
            <div class="divide-y divide-border">
              <label
                v-for="environment in projectEnvs"
                :key="environment.id"
                class="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors"
                :class="isSelected(environment.id) ? 'bg-primary/5' : ''"
              >
                <input
                  type="checkbox"
                  :checked="isSelected(environment.id)"
                  @change="toggleEnvironment(environment.id)"
                  class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
                />
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-medium text-foreground">{{ environment.name }}</span>
                </div>
                <div v-if="isSelected(environment.id)" class="w-36" @click.stop>
                  <Select
                    :model-value="environmentAccess[environment.id]"
                    :options="accessLevelOptions"
                    @update:model-value="(val: string) => setAccessLevel(environment.id, val)"
                  />
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          @click="emit('close')"
          :disabled="loading"
        >
          Cancel
        </Button>
        <Button
          @click="handleSave"
          :loading="loading"
          :disabled="!hasChanges"
        >
          <Icon name="lucide:save" class="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Select from '@/components/ui/Select.vue'

interface Member {
  id: string
  user_id: string
  email: string
  environment_access: readonly { environment_id: string; access_level: 'read' | 'write' }[]
}

interface Environment {
  id: string
  name: string
  project_id: string
  project_name?: string
}

interface Props {
  member: Member | null
  environments: Environment[]
  organizationId: string
}

interface Emits {
  (e: 'close'): void
  (e: 'save', payload: {
    userId: string
    environmentIds: string[]
    accessLevels: { environment_id: string; access_level: 'read' | 'write' }[]
  }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const environmentAccess = ref<Record<string, 'read' | 'write'>>({})
const loading = ref(false)

const accessLevelOptions = [
  { label: 'Read-only', value: 'read' },
  { label: 'Read & Write', value: 'write' }
]

const isSelected = (envId: string) => envId in environmentAccess.value

// Group environments by project name
const environmentsByProject = computed(() => {
  const grouped: Record<string, Environment[]> = {}
  for (const env of props.environments) {
    const projectName = env.project_name || 'Unknown Project'
    if (!grouped[projectName]) {
      grouped[projectName] = []
    }
    grouped[projectName].push(env)
  }
  return grouped
})

const toggleEnvironment = (envId: string) => {
  if (isSelected(envId)) {
    const newAccess = { ...environmentAccess.value }
    delete newAccess[envId]
    environmentAccess.value = newAccess
  } else {
    environmentAccess.value = { ...environmentAccess.value, [envId]: 'read' }
  }
}

const setAccessLevel = (envId: string, level: string) => {
  environmentAccess.value = {
    ...environmentAccess.value,
    [envId]: level === 'write' ? 'write' : 'read'
  }
}

// Initialize with current access when modal opens
watch(() => props.member, (newMember) => {
  if (newMember) {
    const access: Record<string, 'read' | 'write'> = {}
    for (const entry of newMember.environment_access) {
      access[entry.environment_id] = entry.access_level
    }
    environmentAccess.value = access
  } else {
    environmentAccess.value = {}
  }
}, { immediate: true })

// Check if there are any changes from the original state
const hasChanges = computed(() => {
  if (!props.member) return false
  const original: Record<string, string> = {}
  for (const entry of props.member.environment_access) {
    original[entry.environment_id] = entry.access_level
  }
  const current = environmentAccess.value
  const origKeys = Object.keys(original).sort()
  const currKeys = Object.keys(current).sort()
  if (origKeys.length !== currKeys.length) return true
  return !origKeys.every((key, i) => key === currKeys[i] && original[key] === current[key])
})

const handleSave = () => {
  if (!props.member) return

  loading.value = true

  const accessLevels = Object.entries(environmentAccess.value).map(([envId, level]) => ({
    environment_id: envId,
    access_level: level
  }))

  emit('save', {
    userId: props.member.user_id,
    environmentIds: Object.keys(environmentAccess.value),
    accessLevels
  })

  // Reset loading state after emit (parent should handle actual loading state)
  // This is just for immediate UI feedback
  setTimeout(() => {
    loading.value = false
  }, 100)
}
</script>
