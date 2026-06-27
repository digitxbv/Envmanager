<template>
  <div class="space-y-4">
    <!-- Resource Type Selector -->
    <div class="space-y-2">
      <label class="block text-sm font-medium">Resource Type</label>
      <div class="flex gap-2">
        <button
          v-for="type in resourceTypes"
          :key="type.value"
          type="button"
          :class="[
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            selectedResourceType === type.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          ]"
          @click="selectResourceType(type.value)"
        >
          {{ type.label }} ({{ getResourceCount(type.value) }})
        </button>
      </div>
    </div>

    <!-- Search/Filter -->
    <div class="space-y-2">
      <label class="block text-sm font-medium">Search</label>
      <Input v-model="searchQuery" :placeholder="`Search ${selectedResourceType}s...`" />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
      Loading resources...
    </div>

    <!-- Resource Selector -->
    <div v-else class="space-y-2">
      <label class="block text-sm font-medium">Coolify {{ resourceTypeLabel }}</label>
      <div v-if="filteredResources.length === 0" class="text-sm text-muted-foreground">
        No {{ selectedResourceType }}s found. Create a {{ selectedResourceType }} in Coolify first.
      </div>
      <select
        v-else
        v-model="selectedUuid"
        class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @change="emitChange"
      >
        <option :value="null" disabled>Select a {{ selectedResourceType }}</option>
        <option
          v-for="resource in filteredResources"
          :key="resource.uuid"
          :value="resource.uuid"
        >
          {{ resource.name }}
          <template v-if="resource.fqdn"> - {{ resource.fqdn }}</template>
          <template v-else-if="resource.type"> ({{ resource.type }})</template>
        </option>
      </select>
    </div>

    <!-- Selected Resource Info -->
    <div v-if="hasValidSelection" class="rounded-md border bg-muted/30 p-3">
      <div class="flex items-center gap-2">
        <Icon :name="selectedIcon || 'lucide:server'" class="h-5 w-5 text-muted-foreground" />
        <span class="font-medium">{{ selectedResource?.name }}</span>
        <span class="text-xs px-2 py-0.5 rounded bg-muted">{{ resourceTypeLabel }}</span>
        <template v-if="selectedResource?.fqdn">
          <span class="text-muted-foreground">|</span>
          <span class="text-sm text-muted-foreground">{{ selectedResource.fqdn }}</span>
        </template>
        <template v-else-if="selectedResource?.type">
          <span class="text-muted-foreground">|</span>
          <span class="text-sm text-muted-foreground">{{ selectedResource.type }}</span>
        </template>
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

type ResourceType = 'application' | 'database' | 'service'

interface CoolifyApplication {
  uuid: string
  name: string
  fqdn: string | null
  status: string
}

interface CoolifyDatabase {
  uuid: string
  name: string
  type: string
  status: string
}

interface CoolifyService {
  uuid: string
  name: string
  description: string
  status: string
}

// Union type for any resource
interface CoolifyResource {
  uuid: string
  name: string
  fqdn?: string | null
  type?: string
  status: string
}

// Emitted selection object (what ConfigureModal needs)
interface SelectedResource {
  uuid: string
  name: string
  fqdn?: string | null
  type?: string
  resource_type: ResourceType
}

interface Props {
  connectionId: string
  modelValue?: SelectedResource | null
}

// =====================================================
// Props & Emits
// =====================================================

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: SelectedResource | null]
}>()

const client = useSupabaseClient<Database>()

// =====================================================
// Constants
// =====================================================

const resourceTypes = [
  { value: 'application' as ResourceType, label: 'Application' },
  { value: 'database' as ResourceType, label: 'Database' },
  { value: 'service' as ResourceType, label: 'Service' }
]

// =====================================================
// State
// =====================================================

const loading = ref(false)
const searchQuery = ref('')
const selectedResourceType = ref<ResourceType>(props.modelValue?.resource_type ?? 'application')
const applications = ref<CoolifyApplication[]>([])
const databases = ref<CoolifyDatabase[]>([])
const services = ref<CoolifyService[]>([])
const selectedUuid = ref<string | null>(props.modelValue?.uuid ?? null)

// =====================================================
// Computed
// =====================================================

const resourceTypeLabel = computed(() => {
  const type = resourceTypes.find(t => t.value === selectedResourceType.value)
  return type?.label || 'Resource'
})

const selectedIcon = computed(() => {
  switch (selectedResourceType.value) {
    case 'database': return 'lucide:database'
    case 'service': return 'lucide:server'
    default: return 'lucide:server'
  }
})

const currentResources = computed((): CoolifyResource[] => {
  switch (selectedResourceType.value) {
    case 'database':
      return databases.value.map(db => ({ uuid: db.uuid, name: db.name, type: db.type, status: db.status }))
    case 'service':
      return services.value.map(svc => ({ uuid: svc.uuid, name: svc.name, status: svc.status }))
    default:
      return applications.value.map(app => ({ uuid: app.uuid, name: app.name, fqdn: app.fqdn, status: app.status }))
  }
})

const filteredResources = computed(() => {
  if (!searchQuery.value.trim()) return currentResources.value
  const query = searchQuery.value.toLowerCase()
  return currentResources.value.filter(r =>
    r.name.toLowerCase().includes(query) ||
    r.fqdn?.toLowerCase().includes(query) ||
    r.type?.toLowerCase().includes(query)
  )
})

const selectedResource = computed(() =>
  currentResources.value.find(r => r.uuid === selectedUuid.value)
)

const hasValidSelection = computed(() => {
  return selectedUuid.value !== null
})

function getResourceCount(type: ResourceType): number {
  switch (type) {
    case 'database': return databases.value.length
    case 'service': return services.value.length
    default: return applications.value.length
  }
}

// =====================================================
// Methods
// =====================================================

async function loadResources() {
  loading.value = true
  applications.value = []
  databases.value = []
  services.value = []

  try {
    const { data, error } = await client.functions.invoke('coolify-list-resources', {
      body: { connection_id: props.connectionId }
    })

    if (error) throw error

    applications.value = data.applications || []
    databases.value = data.databases || []
    services.value = data.services || []

    console.log('[CoolifyTargetSelect] Loaded:', applications.value.length, 'apps,', databases.value.length, 'dbs,', services.value.length, 'services')

  } catch (err) {
    console.error('[CoolifyTargetSelect] Failed to load resources:', err)
  } finally {
    loading.value = false
  }
}

function selectResourceType(type: ResourceType) {
  selectedResourceType.value = type
  // Clear selection when switching types
  selectedUuid.value = null
  emit('update:modelValue', null)
}

function emitChange() {
  if (!selectedUuid.value) {
    emit('update:modelValue', null)
    return
  }

  const resource = currentResources.value.find(r => r.uuid === selectedUuid.value)
  emit('update:modelValue', resource ? {
    uuid: resource.uuid,
    name: resource.name,
    fqdn: resource.fqdn,
    type: resource.type,
    resource_type: selectedResourceType.value
  } : null)
}

// =====================================================
// Watchers
// =====================================================

// Sync with modelValue prop
watch(() => props.modelValue, (val) => {
  selectedUuid.value = val?.uuid ?? null
  if (val?.resource_type) {
    selectedResourceType.value = val.resource_type
  }
}, { immediate: true })

// =====================================================
// Lifecycle
// =====================================================

onMounted(() => {
  loadResources()
})
</script>
