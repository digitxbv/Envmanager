<template>
  <div class="space-y-4">
    <!-- Search/Filter -->
    <div class="space-y-2">
      <label class="block text-sm font-medium">Search</label>
      <Input v-model="searchQuery" placeholder="Search projects..." />
    </div>

    <!-- Workspace Selector (if teams available) -->
    <div v-if="workspaces.length > 0" class="space-y-2">
      <label class="block text-sm font-medium">Workspace / Team</label>
      <select
        v-model="selectedWorkspaceId"
        class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        :disabled="loading"
        @change="handleWorkspaceChange"
      >
        <option :value="null">Personal Account</option>
        <option
          v-for="workspace in workspaces"
          :key="workspace.id"
          :value="workspace.id"
        >
          {{ workspace.name }}
        </option>
      </select>
    </div>

    <!-- Project Selector -->
    <div class="space-y-2">
      <label class="block text-sm font-medium">Railway Project</label>
      <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
        Loading projects...
      </div>
      <select
        v-else-if="filteredProjects.length > 0"
        v-model="selectedProjectId"
        class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @change="handleProjectChange"
      >
        <option :value="null" disabled>Select a project</option>
        <option
          v-for="project in filteredProjects"
          :key="project.id"
          :value="project.id"
        >
          {{ project.name }}
          <template v-if="project.services.length > 0">
            ({{ project.services.length }} services)
          </template>
        </option>
      </select>
      <div v-else class="text-sm text-muted-foreground">
        No projects found. Create a project in Railway first.
      </div>
    </div>

    <!-- Target Type (only if project selected) -->
    <div v-if="selectedProject" class="space-y-2">
      <label class="block text-sm font-medium">Sync Target</label>
      <div class="grid gap-2">
        <!-- Shared Variables option (at top per CONTEXT.md) -->
        <label
          class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30"
          :class="targetType === 'shared' && 'border-primary bg-primary/5'"
        >
          <input type="radio" v-model="targetType" value="shared" class="sr-only" />
          <Icon name="lucide:globe" class="h-5 w-5" />
          <div>
            <p class="font-medium">Shared Variables</p>
            <p class="text-xs text-muted-foreground">
              Available to all services in {{ selectedProject.name }}
            </p>
          </div>
        </label>

        <!-- Service-specific option -->
        <label
          class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30"
          :class="targetType === 'service' && 'border-primary bg-primary/5'"
        >
          <input type="radio" v-model="targetType" value="service" class="sr-only" />
          <Icon name="lucide:server" class="h-5 w-5" />
          <div>
            <p class="font-medium">Specific Service</p>
            <p class="text-xs text-muted-foreground">
              Variables for one service only
            </p>
          </div>
        </label>
      </div>
    </div>

    <!-- Service Selector (only if target type is service) -->
    <div v-if="targetType === 'service' && selectedProject" class="space-y-2">
      <label class="block text-sm font-medium">Select Service</label>
      <div v-if="selectedProject.services.length === 0" class="text-sm text-muted-foreground">
        No services in this project yet.
      </div>
      <select
        v-else
        v-model="selectedServiceId"
        class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @change="emitChange"
      >
        <option :value="null" disabled>Select a service</option>
        <option
          v-for="service in selectedProject.services"
          :key="service.id"
          :value="service.id"
        >
          {{ service.name }}
        </option>
      </select>
    </div>

    <!-- Selected Target Info -->
    <div v-if="hasValidSelection" class="rounded-md border bg-muted/30 p-3">
      <div class="flex items-center gap-2">
        <Icon name="lucide:git-branch" class="h-5 w-5" />
        <span class="font-medium">{{ selectedProject?.name }}</span>
        <span class="text-muted-foreground">
          {{ targetType === 'shared' ? '(Shared Variables)' : `/ ${selectedServiceName}` }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from '~/components/ui/Input.vue'
import type { Database } from '~/types/database.types'

// =====================================================
// Types
// =====================================================

interface RailwayService {
  id: string
  name: string
}

interface RailwayEnvironment {
  id: string
  name: string
}

interface RailwayProject {
  id: string
  name: string
  services: RailwayService[]
  environments: RailwayEnvironment[]
}

interface RailwayWorkspace {
  id: string
  name: string
}

interface SelectedTarget {
  projectId: string
  projectName: string
  workspaceId: string | null  // null = personal account
  serviceId: string | null  // null = shared variables
  serviceName: string | null
  environments: RailwayEnvironment[]  // Available Railway environments
}

interface Props {
  connectionId: string
  workspaceId?: string  // Pre-selected workspace from connection metadata
  modelValue?: SelectedTarget | null
}

// =====================================================
// Props & Emits
// =====================================================

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: SelectedTarget | null]
}>()

const client = useSupabaseClient<Database>()

// =====================================================
// State
// =====================================================

const loading = ref(false)
const searchQuery = ref('')
const workspaces = ref<RailwayWorkspace[]>([])
const projects = ref<RailwayProject[]>([])
const selectedWorkspaceId = ref<string | null>(props.workspaceId || null)
const selectedProjectId = ref<string | null>(props.modelValue?.projectId ?? null)
const selectedServiceId = ref<string | null>(props.modelValue?.serviceId ?? null)
const targetType = ref<'shared' | 'service'>(
  props.modelValue?.serviceId ? 'service' : 'shared'
)

// =====================================================
// Computed
// =====================================================

const filteredProjects = computed(() => {
  if (!searchQuery.value.trim()) return projects.value
  const query = searchQuery.value.toLowerCase()
  return projects.value.filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.services.some(s => s.name.toLowerCase().includes(query))
  )
})

const selectedProject = computed(() =>
  projects.value.find(p => p.id === selectedProjectId.value)
)

const selectedServiceName = computed(() => {
  if (!selectedProject.value || !selectedServiceId.value) return null
  const service = selectedProject.value.services.find(s => s.id === selectedServiceId.value)
  return service?.name || null
})

const hasValidSelection = computed(() => {
  if (!selectedProject.value) return false
  if (targetType.value === 'shared') return true
  return targetType.value === 'service' && selectedServiceId.value !== null
})

// =====================================================
// Methods
// =====================================================

async function loadResources(workspaceId?: string | null) {
  loading.value = true
  projects.value = []

  try {
    const { data, error } = await client.functions.invoke('railway-list-resources', {
      body: {
        connection_id: props.connectionId,
        workspace_id: workspaceId || undefined
      }
    })

    if (error) throw error

    // Store workspaces if returned (first call without workspace_id)
    if (data.workspaces) {
      workspaces.value = data.workspaces
    }

    projects.value = data.projects || []

    console.log('[RailwayTargetSelect] Loaded projects:', projects.value.length)

  } catch (err) {
    console.error('[RailwayTargetSelect] Failed to load resources:', err)
  } finally {
    loading.value = false
  }
}

function handleWorkspaceChange() {
  // Reset selections when workspace changes
  selectedProjectId.value = null
  selectedServiceId.value = null
  targetType.value = 'shared'
  emitChange()
  loadResources(selectedWorkspaceId.value)
}

function handleProjectChange() {
  // Reset service selection when project changes
  selectedServiceId.value = null
  targetType.value = 'shared'
  emitChange()
}

function emitChange() {
  if (!selectedProject.value) {
    emit('update:modelValue', null)
    return
  }

  // Only emit valid selections
  if (!hasValidSelection.value) {
    emit('update:modelValue', null)
    return
  }

  emit('update:modelValue', {
    projectId: selectedProject.value.id,
    projectName: selectedProject.value.name,
    workspaceId: selectedWorkspaceId.value,
    serviceId: targetType.value === 'service' ? selectedServiceId.value : null,
    serviceName: targetType.value === 'service' ? selectedServiceName.value : null,
    environments: selectedProject.value.environments
  })
}

// =====================================================
// Watchers
// =====================================================

// Watch target type and emit changes
watch(targetType, () => {
  // Reset service selection when switching to shared
  if (targetType.value === 'shared') {
    selectedServiceId.value = null
  }
  emitChange()
})

// Sync with modelValue prop
watch(() => props.modelValue, (val) => {
  if (val) {
    selectedProjectId.value = val.projectId
    selectedServiceId.value = val.serviceId
    targetType.value = val.serviceId ? 'service' : 'shared'
  }
}, { immediate: true })

// =====================================================
// Lifecycle
// =====================================================

onMounted(() => {
  loadResources(selectedWorkspaceId.value)
})
</script>
