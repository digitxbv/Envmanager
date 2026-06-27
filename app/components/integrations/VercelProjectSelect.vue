<template>
  <div class="space-y-4">
    <!-- Team Selector (if teams available) -->
    <div v-if="teams.length > 0" class="space-y-2">
      <label class="block text-sm font-medium">Account / Team</label>
      <select
        v-model="selectedTeamId"
        class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        :disabled="loading"
        @change="handleTeamChange"
      >
        <option :value="null">Personal Account</option>
        <option
          v-for="team in teams"
          :key="team.id"
          :value="team.id"
        >
          {{ team.name }}
        </option>
      </select>
    </div>

    <!-- Project Selector -->
    <div class="space-y-2">
      <label class="block text-sm font-medium">Vercel Project</label>
      <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
        Loading projects...
      </div>
      <select
        v-else-if="projects.length > 0"
        v-model="selectedProjectId"
        class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @change="handleProjectChange"
      >
        <option :value="null" disabled>Select a project</option>
        <option
          v-for="project in projects"
          :key="project.id"
          :value="project.id"
        >
          {{ project.name }}
          <template v-if="project.framework">
            ({{ project.framework }})
          </template>
        </option>
      </select>
      <div v-else class="text-sm text-muted-foreground">
        No projects found. Create a project in Vercel first.
      </div>
    </div>

    <!-- Selected Project Info -->
    <div
      v-if="selectedProject"
      class="rounded-md border bg-muted/30 p-3"
    >
      <div class="flex items-center gap-2">
        <Icon name="lucide:globe" class="h-5 w-5" />
        <span class="font-medium">{{ selectedProject.name }}</span>
      </div>
      <p v-if="selectedProject.framework" class="text-xs text-muted-foreground mt-1">
        Framework: {{ selectedProject.framework }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  useVercelIntegration,
  type VercelTeam,
  type VercelProject
} from '~/composables/useVercelIntegration'

interface Props {
  connectionId: string
  teams: VercelTeam[]
  modelValue?: { projectId: string; teamId: string | null } | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: { projectId: string; teamId: string | null } | null]
}>()

const { listProjects } = useVercelIntegration()

// =====================================================
// State
// =====================================================

const selectedTeamId = ref<string | null>(props.modelValue?.teamId ?? null)
const selectedProjectId = ref<string | null>(props.modelValue?.projectId ?? null)
const projects = ref<VercelProject[]>([])
const loading = ref(false)

// =====================================================
// Computed
// =====================================================

const selectedProject = computed(() =>
  projects.value.find(p => p.id === selectedProjectId.value)
)

// =====================================================
// Methods
// =====================================================

async function loadProjects() {
  loading.value = true
  projects.value = await listProjects(props.connectionId, selectedTeamId.value ?? undefined)
  loading.value = false
}

function handleTeamChange() {
  selectedProjectId.value = null
  emitChange()
  loadProjects()
}

function handleProjectChange() {
  emitChange()
}

function emitChange() {
  if (selectedProjectId.value) {
    emit('update:modelValue', {
      projectId: selectedProjectId.value,
      teamId: selectedTeamId.value
    })
  } else {
    emit('update:modelValue', null)
  }
}

// =====================================================
// Lifecycle
// =====================================================

onMounted(() => {
  loadProjects()
})

// Sync with modelValue prop
watch(() => props.modelValue, (val) => {
  if (val) {
    selectedProjectId.value = val.projectId
    selectedTeamId.value = val.teamId
  }
}, { immediate: true })
</script>
