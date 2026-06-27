<template>
  <div class="space-y-4">
    <!-- Target Type Selection -->
    <div class="space-y-2">
      <label class="block text-sm font-medium">Sync Target Type</label>
      <div class="grid gap-2">
        <!-- Service option -->
        <label
          class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30"
          :class="targetType === 'service' && 'border-primary bg-primary/5'"
        >
          <input type="radio" v-model="targetType" value="service" class="sr-only" />
          <Icon name="lucide:server" class="h-5 w-5" />
          <div>
            <p class="font-medium">Service</p>
            <p class="text-xs text-muted-foreground">
              Sync to a specific Render service
            </p>
          </div>
        </label>

        <!-- Env Group option -->
        <label
          class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30"
          :class="targetType === 'env_group' && 'border-primary bg-primary/5'"
        >
          <input type="radio" v-model="targetType" value="env_group" class="sr-only" />
          <Icon name="lucide:folder" class="h-5 w-5" />
          <div>
            <p class="font-medium">Environment Group</p>
            <p class="text-xs text-muted-foreground">
              Shared variables across multiple services
            </p>
          </div>
        </label>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
      Loading resources...
    </div>

    <!-- Service Selector (if service type selected) -->
    <div v-else-if="targetType === 'service'" class="space-y-2">
      <label class="block text-sm font-medium">Select Service</label>
      <div v-if="services.length === 0" class="text-sm text-muted-foreground">
        No services found. Create a service in Render first.
      </div>
      <select
        v-else
        v-model="selectedId"
        class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @change="emitChange"
      >
        <option :value="null" disabled>Select a service</option>
        <option
          v-for="service in services"
          :key="service.id"
          :value="service.id"
        >
          {{ service.name }} ({{ service.type }})
        </option>
      </select>
    </div>

    <!-- Env Group Selector (if env_group type selected) -->
    <div v-else-if="targetType === 'env_group'" class="space-y-2">
      <label class="block text-sm font-medium">Select Environment Group</label>

      <!-- Existing groups or create new -->
      <div class="space-y-3">
        <!-- Create New option -->
        <label
          class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30"
          :class="createNewGroup && 'border-primary bg-primary/5'"
        >
          <input type="radio" :checked="createNewGroup" @change="createNewGroup = true; selectedId = null" class="sr-only" />
          <Icon name="lucide:plus" class="h-5 w-5" />
          <div>
            <p class="font-medium">Create New</p>
            <p class="text-xs text-muted-foreground">
              Create a new environment group
            </p>
          </div>
        </label>

        <!-- Use existing option -->
        <label
          v-if="envGroups.length > 0"
          class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30"
          :class="!createNewGroup && 'border-primary bg-primary/5'"
        >
          <input type="radio" :checked="!createNewGroup" @change="createNewGroup = false" class="sr-only" />
          <Icon name="lucide:folder-open" class="h-5 w-5" />
          <div>
            <p class="font-medium">Use Existing</p>
            <p class="text-xs text-muted-foreground">
              Select an existing environment group
            </p>
          </div>
        </label>
      </div>

      <!-- New Group Name Input -->
      <div v-if="createNewGroup" class="space-y-2 mt-3">
        <label class="block text-sm font-medium">New Group Name</label>
        <Input
          v-model="newGroupName"
          placeholder="e.g., production-secrets"
          @input="emitChange"
        />
      </div>

      <!-- Existing Group Selector -->
      <div v-else-if="envGroups.length > 0" class="mt-3">
        <select
          v-model="selectedId"
          class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
          @change="emitChange"
        >
          <option :value="null" disabled>Select an environment group</option>
          <option
            v-for="group in envGroups"
            :key="group.id"
            :value="group.id"
          >
            {{ group.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Selected Target Info -->
    <div v-if="hasValidSelection" class="rounded-md border bg-muted/30 p-3">
      <div class="flex items-center gap-2">
        <Icon name="lucide:server" class="h-5 w-5 text-muted-foreground" />
        <span class="font-medium">{{ selectedName }}</span>
        <span class="text-muted-foreground">
          ({{ targetType === 'service' ? 'Service' : 'Env Group' }})
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from '~/components/ui/Input.vue'
import { useRenderIntegration, type RenderService, type RenderEnvGroup } from '~/composables/useRenderIntegration'

// =====================================================
// Types
// =====================================================

interface SelectedTarget {
  type: 'service' | 'env_group'
  id: string | null
  name: string
  createNew?: boolean
  newGroupName?: string
}

interface Props {
  connectionId: string
  ownerId: string
  ownerName: string
  modelValue?: SelectedTarget | null
}

// =====================================================
// Props & Emits
// =====================================================

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: SelectedTarget | null]
}>()

const { listResources } = useRenderIntegration()

// =====================================================
// State
// =====================================================

const loading = ref(false)
const services = ref<RenderService[]>([])
const envGroups = ref<RenderEnvGroup[]>([])
const targetType = ref<'service' | 'env_group'>(props.modelValue?.type ?? 'service')
const selectedId = ref<string | null>(props.modelValue?.id ?? null)
const createNewGroup = ref(props.modelValue?.createNew ?? false)
const newGroupName = ref(props.modelValue?.newGroupName ?? '')

// =====================================================
// Computed
// =====================================================

const selectedName = computed(() => {
  if (targetType.value === 'service') {
    const service = services.value.find(s => s.id === selectedId.value)
    return service?.name || ''
  } else if (createNewGroup.value) {
    return newGroupName.value || 'New Group'
  } else {
    const group = envGroups.value.find(g => g.id === selectedId.value)
    return group?.name || ''
  }
})

const hasValidSelection = computed(() => {
  if (targetType.value === 'service') {
    return selectedId.value !== null
  } else if (createNewGroup.value) {
    return newGroupName.value.trim().length > 0
  } else {
    return selectedId.value !== null
  }
})

// =====================================================
// Methods
// =====================================================

async function loadResources() {
  loading.value = true
  services.value = []
  envGroups.value = []

  try {
    const result = await listResources(props.connectionId, props.ownerId)
    services.value = result.services
    envGroups.value = result.envGroups
    console.log('[RenderTargetSelect] Loaded', services.value.length, 'services,', envGroups.value.length, 'env groups')
  } catch (err) {
    console.error('[RenderTargetSelect] Failed to load resources:', err)
  } finally {
    loading.value = false
  }
}

function emitChange() {
  if (!hasValidSelection.value) {
    emit('update:modelValue', null)
    return
  }

  if (targetType.value === 'service') {
    emit('update:modelValue', {
      type: 'service',
      id: selectedId.value,
      name: selectedName.value
    })
  } else if (createNewGroup.value) {
    emit('update:modelValue', {
      type: 'env_group',
      id: null,
      name: newGroupName.value,
      createNew: true,
      newGroupName: newGroupName.value
    })
  } else {
    emit('update:modelValue', {
      type: 'env_group',
      id: selectedId.value,
      name: selectedName.value,
      createNew: false
    })
  }
}

// =====================================================
// Watchers
// =====================================================

// Watch target type and emit changes
watch(targetType, () => {
  selectedId.value = null
  createNewGroup.value = targetType.value === 'env_group'
  newGroupName.value = ''
  emitChange()
})

// Watch createNewGroup toggle
watch(createNewGroup, () => {
  if (createNewGroup.value) {
    selectedId.value = null
  }
  emitChange()
})

// Sync with modelValue prop
watch(() => props.modelValue, (val) => {
  if (val) {
    targetType.value = val.type
    selectedId.value = val.id
    createNewGroup.value = val.createNew ?? false
    newGroupName.value = val.newGroupName ?? ''
  }
}, { immediate: true })

// =====================================================
// Lifecycle
// =====================================================

onMounted(() => {
  loadResources()
})
</script>
