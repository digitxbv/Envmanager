<template>
  <div class="space-y-4">
    <!-- Search/Filter -->
    <div class="space-y-2">
      <label class="block text-sm font-medium">Search</label>
      <Input v-model="searchQuery" placeholder="Search projects or applications..." />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
      Loading projects...
    </div>

    <!-- Project Selector -->
    <div v-else class="space-y-2">
      <label class="block text-sm font-medium">Dokploy Project</label>
      <div v-if="filteredProjects.length === 0" class="text-sm text-muted-foreground">
        No projects found. Create a project in Dokploy first.
      </div>
      <select
        v-else
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
    </div>

    <!-- Service Selector (only if project selected) -->
    <div v-if="selectedProject" class="space-y-2">
      <label class="block text-sm font-medium">Service</label>
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
          v-for="svc in selectedProject.services"
          :key="svc.id"
          :value="svc.id"
        >
          {{ svc.name }} ({{ svc.type }})
        </option>
      </select>
    </div>

    <!-- Selected Target Info -->
    <div v-if="hasValidSelection" class="rounded-md border bg-muted/30 p-3">
      <div class="flex items-center gap-2">
        <Icon name="lucide:server" class="h-5 w-5 text-muted-foreground" />
        <span class="font-medium">{{ selectedProject?.name }}</span>
        <span class="text-muted-foreground">/</span>
        <span>{{ selectedServiceName }}</span>
        <span class="text-xs text-muted-foreground">({{ selectedServiceType }})</span>
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

type DokployServiceType = 'application' | 'compose' | 'mariadb' | 'mongo' | 'mysql' | 'postgres' | 'redis'

interface DokployService {
  id: string
  name: string
  appName: string
  status: string
  type: DokployServiceType
}

interface DokployProject {
  id: string
  name: string
  services: DokployService[]
}

interface SelectedTarget {
  project_id: string
  project_name: string
  service_id: string
  service_name: string
  service_type: DokployServiceType
}

interface Props {
  connectionId: string
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
const projects = ref<DokployProject[]>([])
const selectedProjectId = ref<string | null>(props.modelValue?.project_id ?? null)
const selectedServiceId = ref<string | null>(props.modelValue?.service_id ?? null)

// =====================================================
// Computed
// =====================================================

const filteredProjects = computed(() => {
  if (!searchQuery.value.trim()) return projects.value
  const query = searchQuery.value.toLowerCase()
  return projects.value.filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.services.some(s =>
      s.name.toLowerCase().includes(query) ||
      s.appName?.toLowerCase().includes(query) ||
      s.type.toLowerCase().includes(query)
    )
  )
})

const selectedProject = computed(() =>
  projects.value.find(p => p.id === selectedProjectId.value)
)

const selectedService = computed(() => {
  if (!selectedProject.value || !selectedServiceId.value) return null
  return selectedProject.value.services.find(s => s.id === selectedServiceId.value) || null
})

const selectedServiceName = computed(() => selectedService.value?.name || null)
const selectedServiceType = computed(() => selectedService.value?.type || null)

const hasValidSelection = computed(() => {
  return selectedProject.value && selectedServiceId.value !== null
})

// =====================================================
// Methods
// =====================================================

async function loadResources() {
  loading.value = true
  projects.value = []

  try {
    const { data, error } = await client.functions.invoke('dokploy-list-resources', {
      body: { connection_id: props.connectionId }
    })

    if (error) throw error

    projects.value = data.projects || []

    console.log('[DokployTargetSelect] Loaded projects:', projects.value.length)

  } catch (err) {
    console.error('[DokployTargetSelect] Failed to load resources:', err)
  } finally {
    loading.value = false
  }
}

function handleProjectChange() {
  // Reset service selection when project changes
  selectedServiceId.value = null
  emitChange()
}

function emitChange() {
  if (!selectedProject.value || !selectedServiceId.value) {
    emit('update:modelValue', null)
    return
  }

  const svc = selectedProject.value.services.find(s => s.id === selectedServiceId.value)

  emit('update:modelValue', {
    project_id: selectedProject.value.id,
    project_name: selectedProject.value.name,
    service_id: selectedServiceId.value,
    service_name: svc?.name || '',
    service_type: svc?.type || 'application'
  })
}

// =====================================================
// Watchers
// =====================================================

// Sync with modelValue prop
watch(() => props.modelValue, (val) => {
  if (val) {
    selectedProjectId.value = val.project_id
    selectedServiceId.value = val.service_id
  }
}, { immediate: true })

// =====================================================
// Lifecycle
// =====================================================

onMounted(() => {
  loadResources()
})
</script>
