<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <!-- Page header -->
    <PageHeader title="Projects" description="Manage your environment configurations">
      <template #actions>
        <Button v-if="canManageProjects" @click="navigateTo('/dashboard/projects/new')">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          New Project
        </Button>
      </template>
    </PageHeader>

    <!-- Loading state -->
    <LoadingSpinner v-if="loading" class="py-24" />

    <!-- Error state -->
    <Card v-else-if="error" padding="lg" class-name="max-w-lg mx-auto">
      <div class="flex flex-col items-center text-center space-y-4">
        <div class="rounded-full bg-destructive/10 p-3">
          <Icon name="lucide:alert-circle" class="h-5 w-5 text-destructive" />
        </div>
        <div class="space-y-1.5">
          <h2 class="text-base font-medium text-foreground">Failed to load projects</h2>
          <p class="text-sm text-muted-foreground max-w-sm">{{ error }}</p>
        </div>
        <Button variant="outline" size="sm" @click="fetchProjects">
          <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    </Card>

    <!-- Empty state -->
    <EmptyState
      v-else-if="projects.length === 0"
      icon="lucide:folder"
      title="No projects yet"
      description="Get started by creating your first project. Projects help you organize your environment variables."
    >
      <Button v-if="canManageProjects" @click="navigateTo('/dashboard/projects/new')">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Create Project
      </Button>
    </EmptyState>

    <!-- Project grid -->
    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="project in projects"
        :key="project.id"
        hover
        class-name="group relative"
      >
        <div class="flex items-start justify-between gap-3">
          <!-- Project icon: first-letter avatar -->
          <div class="flex items-start gap-3 min-w-0">
            <div class="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span class="text-sm font-semibold text-primary">{{ project.name?.charAt(0)?.toUpperCase() || 'P' }}</span>
            </div>
            <div class="min-w-0">
              <h3 class="font-medium text-foreground truncate">{{ project.name }}</h3>
              <div class="mt-1">
                <Badge variant="outline" size="sm">
                  {{ project.environments?.length || 0 }} {{ (project.environments?.length || 0) === 1 ? 'env' : 'envs' }}
                </Badge>
              </div>
            </div>
          </div>

          <!-- Actions menu -->
          <button
            v-if="canManageProjects"
            class="opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 relative z-10"
            @click.prevent="showProjectMenu(project)"
          >
            <Icon name="lucide:more-horizontal" class="h-4 w-4" />
          </button>
        </div>

        <!-- Description -->
        <p v-if="project.description" class="mt-3 text-sm text-muted-foreground line-clamp-2">
          {{ project.description }}
        </p>

        <!-- Updated timestamp -->
        <ClientOnly>
          <template #default>
            <p class="mt-3 text-xs text-muted-foreground/70">
              Updated {{ formatDate(project.updated_at) }}
            </p>
          </template>
        </ClientOnly>

        <!-- Full card click area -->
        <NuxtLink
          :to="`/dashboard/projects/${project.id}`"
          class="absolute inset-0 rounded-lg"
        />
      </Card>
    </div>

    <!-- Project Actions Dialog -->
    <ClientOnly>
      <Dialog
        :open="!!selectedProject && !showDeleteConfirm"
        :title="selectedProject?.name || ''"
        :description="selectedProject?.description || 'No description'"
        max-width="sm"
        @close="selectedProject = null"
      >
        <div class="space-y-2">
          <Button
            variant="outline"
            class-name="w-full justify-start"
            @click="navigateTo(`/dashboard/projects/${selectedProject?.id}/settings`)"
          >
            <Icon name="lucide:settings" class="mr-2 h-4 w-4" />
            Project Settings
          </Button>
          <Button
            variant="destructive"
            class-name="w-full justify-start"
            @click="confirmDeleteProject"
          >
            <Icon name="lucide:trash" class="mr-2 h-4 w-4" />
            Delete Project
          </Button>
        </div>
      </Dialog>
    </ClientOnly>

    <!-- Delete Confirmation Dialog -->
    <ClientOnly>
      <Dialog
        :open="showDeleteConfirm"
        title="Delete Project"
        max-width="sm"
        @close="showDeleteConfirm = false"
      >
        <p class="text-sm text-muted-foreground mb-6">
          Are you sure you want to delete <span class="font-medium text-foreground">{{ selectedProject?.name }}</span>? This action cannot be undone.
        </p>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showDeleteConfirm = false">
            Cancel
          </Button>
          <Button
            variant="destructive"
            :loading="deleteLoading"
            @click="deleteProject"
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </ClientOnly>
  </div>
</template>

<script setup>
import Button from '@/components/ui/Button.vue'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

// Set breadcrumbs
// @ts-ignore
const breadcrumbs = inject('breadcrumbs', ref([]))
breadcrumbs.value = [{ label: 'Dashboard' }]

const user = useSupabaseUser()
const client = useSupabaseClient()
const { $toast } = useNuxtApp()
const organizationStore = useOrganizationStore()
const { getCurrentUserRole } = useTeamManagement()

const loading = ref(true)
const currentUserRole = ref(null)

// Only owners and admins can create/edit/delete projects
const canManageProjects = computed(() =>
  currentUserRole.value === 'owner' || currentUserRole.value === 'admin'
)
const error = ref(null)
const projects = ref([])
const selectedProject = ref(null)
const showDeleteConfirm = ref(false)
const deleteLoading = ref(false)

// Fetch projects
const fetchProjects = async () => {
  loading.value = true
  error.value = null

  try {
    const { data, error: fetchError } = await client
      .from('projects')
      .select('*, environments(*)')
      .order('updated_at', { ascending: false })

    if (fetchError) {
      // Check for RLS error 42P17
      if (fetchError.code === '42P17') {
        throw new Error('Database security policy error. Please contact support.')
      }
      throw fetchError
    }

    projects.value = data || []
  } catch (err) {
    const errorMessage = err.message || 'Failed to load projects. Please try again.'
    error.value = errorMessage
    $toast.error(errorMessage)
    console.error(err)
  } finally {
    loading.value = false
  }
}

// Show project menu
const showProjectMenu = (project) => {
  selectedProject.value = project
}

// Confirm delete project
const confirmDeleteProject = () => {
  showDeleteConfirm.value = true
}

// Delete project
const deleteProject = async () => {
  if (!selectedProject.value) return
  
  deleteLoading.value = true
  
  try {
    const { error } = await client
      .from('projects')
      .delete()
      .eq('id', selectedProject.value.id)
    
    if (error) throw error
    
    $toast.success(`Project "${selectedProject.value.name}" deleted`)
    showDeleteConfirm.value = false
    selectedProject.value = null
    
    // Refresh projects
    await fetchProjects()
  } catch (error) {
    $toast.error('Failed to delete project')
    console.error(error)
  } finally {
    deleteLoading.value = false
  }
}

// Format date
const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now - date)
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

// Fetch user role when organization changes
watch(
  () => organizationStore.selectedOrganizationId,
  async (orgId) => {
    if (!orgId) return
    currentUserRole.value = await getCurrentUserRole(orgId)
  },
  { immediate: true }
)

// Fetch projects on mount
onMounted(fetchProjects)
</script>
