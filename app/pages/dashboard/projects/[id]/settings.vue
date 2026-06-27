<template>
  <div class="px-4 md:px-6 lg:px-8 py-6 max-w-3xl">
    <LoadingSpinner v-if="loading || roleLoading" class="py-20" />

    <Card v-else-if="!isAdmin" class-name="max-w-xl mx-auto text-center">
      <EmptyState
        icon="lucide:shield-alert"
        title="Access Restricted"
        description="Only organization admins and owners can manage project settings."
      >
        <Button variant="outline" @click="$router.push(`/dashboard/projects/${projectId}`)">
          <Icon name="lucide:arrow-left" class="mr-2 h-4 w-4" />
          Back to Project
        </Button>
      </EmptyState>
    </Card>

    <template v-else-if="project">
      <div class="space-y-6">
        <!-- Header -->
        <PageHeader title="Settings" :description="`Manage settings for ${project.name}`">
          <template #actions>
            <Button variant="outline" @click="$router.push(`/dashboard/projects/${projectId}`)">
              <Icon name="lucide:arrow-left" class="mr-2 h-4 w-4" />
              Back to Project
            </Button>
          </template>
        </PageHeader>
        
        <!-- General Settings -->
        <Card>
          <template #header>
            <div>
              <h2 class="text-base font-semibold text-foreground">General</h2>
              <p class="text-sm text-muted-foreground mt-0.5">
                Update your project details
              </p>
            </div>
          </template>

          <form @submit.prevent="updateProject" class="space-y-4">
            <div class="space-y-2">
              <label for="name" class="text-sm font-medium text-muted-foreground">Project Name</label>
              <Input
                id="name"
                v-model="formName"
                type="text"
                required
                placeholder="My Awesome Project"
                :disabled="updateLoading"
              />
            </div>

            <div class="space-y-2">
              <label for="description" class="text-sm font-medium text-muted-foreground">Description</label>
              <textarea
                id="description"
                v-model="formDescription"
                rows="3"
                placeholder="A brief description of your project"
                class="flex w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-ring/50 focus:border-ring transition-all duration-200"
                :disabled="updateLoading"
              />
            </div>

            <div class="flex justify-end">
              <Button type="submit" :loading="updateLoading">
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
        
        <!-- Environments -->
        <div class="space-y-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-base font-semibold text-foreground">Environments</h2>
              <p class="text-sm text-muted-foreground mt-0.5">
                Manage project environments
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              class-name="w-full sm:w-auto"
              @click="showAddEnvironmentModal = true"
              :disabled="environmentLoading"
            >
              <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
              Add Environment
            </Button>
          </div>
          
          <Card padding="sm" class="!p-0">
            <div v-if="environmentLoading" class="p-6 flex justify-center">
              <Icon name="lucide:loader-2" class="animate-spin h-5 w-5 text-primary" />
            </div>

            <div v-else-if="environments.length === 0" class="p-6 text-center">
              <p class="text-muted-foreground mb-2">No environments found</p>
              <Button
                variant="outline"
                size="sm"
                @click="showAddEnvironmentModal = true"
              >
                <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
                Add Environment
              </Button>
            </div>

            <div v-else class="divide-y divide-border">
              <div
                v-for="env in environments"
                :key="env.id"
                class="p-4 space-y-3"
              >
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="font-medium text-foreground">{{ env.name }}</p>
                    <p class="text-sm text-muted-foreground">
                      {{ getVariableCount(env.id) }} variables
                    </p>
                  </div>
                  <div class="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      @click="showCloneEnvironmentModal(env)"
                    >
                      <Icon name="lucide:copy" class="mr-2 h-4 w-4" />
                      Clone
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      @click="editEnvironment(env)"
                    >
                      <Icon name="lucide:pencil" class="mr-2 h-4 w-4" />
                      Rename
                    </Button>
                    <Tooltip content="Delete environment">
                      <Button
                        variant="ghost"
                        size="sm"
                        @click="deleteEnvironmentConfirm(env)"
                        :disabled="environments.length <= 1"
                      >
                        <Icon name="lucide:trash" class="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
                <div class="flex items-center gap-3 pt-2 border-t border-dashed border-border">
                  <input
                    type="checkbox"
                    :id="`show-values-${env.id}`"
                    :checked="env.show_values_to_readers"
                    @change="toggleShowValuesToReaders(env)"
                    class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                  />
                   <label :for="`show-values-${env.id}`" class="cursor-pointer">
                     <span class="text-sm font-medium text-muted-foreground">Show values to read-only users</span>
                    <p class="text-xs text-muted-foreground">
                      When disabled, read-only users see variable names but values are masked.
                    </p>
                  </label>
                </div>
                <!-- Protection Settings -->
                <div class="pt-3 border-t border-dashed border-border">
                  <ProtectedEnvironmentSettings
                    :environment-id="env.id"
                    :is-protected="env.is_protected"
                    :approval-mode="env.approval_mode as 'single' | 'specific' | 'two_person'"
                    :auto-expire-hours="env.auto_expire_hours || 0"
                    :approvers="getApproversForEnv(env.id)"
                    @update:isProtected="(val) => updateEnvProtection(env, 'is_protected', val)"
                    @update:approvalMode="(val) => updateEnvProtection(env, 'approval_mode', val)"
                    @update:autoExpireHours="(val) => updateEnvProtection(env, 'auto_expire_hours', val)"
                    @addApprover="(userId) => addApprover(env.id, userId)"
                    @removeApprover="(approverId) => removeApprover(approverId)"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <!-- Services -->
        <ProjectServicesSettings
          v-if="project"
          :project-id="projectId"
          :organization-id="project.organization_id"
        />

        <!-- Naming Conventions -->
        <Card>
          <template #header>
            <div>
              <h2 class="text-base font-semibold text-foreground">Naming Conventions</h2>
              <p class="text-sm text-muted-foreground mt-0.5">
                Configure variable naming rules for this project
              </p>
            </div>
          </template>

          <NamingConventionProjectOverride
            :project-id="projectId"
            :organization-id="project.organization_id"
          />
        </Card>

        <!-- Danger Zone -->
        <div class="space-y-4">
          <div>
            <h2 class="text-base font-semibold text-destructive">Danger Zone</h2>
            <p class="text-sm text-muted-foreground mt-0.5">
              Irreversible actions for your project
            </p>
          </div>
          
          <Card className="!border-destructive/20">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 class="font-medium text-foreground">Delete Project</h3>
                <p class="text-sm text-muted-foreground">
                  This will permanently delete the project and all its data
                </p>
              </div>
              <Button
                variant="destructive"
                class-name="w-full sm:w-auto"
                @click="showDeleteProjectModal = true"
              >
                Delete Project
              </Button>
            </div>
          </Card>
        </div>
      </div>
      
      <!-- Add/Edit Environment Modal -->
      <ClientOnly>
        <Dialog
          :open="showAddEnvironmentModal || !!editingEnvironment"
          :title="editingEnvironment ? 'Edit Environment' : 'Add New Environment'"
          @close="cancelEnvironmentEdit"
        >
          <form @submit.prevent="saveEnvironment" class="space-y-4">
            <div class="space-y-2">
              <label for="environmentName" class="text-sm font-medium text-muted-foreground">Environment Name</label>
              <Input
                id="environmentName"
                :key="`env-${editingEnvironment?.id || 'new'}`"
                v-model="environmentForm.name"
                required
                placeholder="staging"
                :disabled="environmentActionLoading"
              />
            </div>
            
            <div class="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline"
                @click="cancelEnvironmentEdit"
                :disabled="environmentActionLoading"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                :loading="environmentActionLoading"
              >
                {{ editingEnvironment ? 'Update' : 'Add' }}
              </Button>
            </div>
          </form>
        </Dialog>
      </ClientOnly>
      
      <!-- Clone Environment Modal -->
      <ClientOnly>
        <Dialog
          :open="!!cloningEnvironment"
          title="Clone Environment"
          @close="cloningEnvironment = null"
        >
          <form @submit.prevent="cloneEnvironment" class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted-foreground">Source Environment</label>
              <p class="text-muted-foreground text-sm">
                All variables from <span class="font-medium text-foreground">{{ cloningEnvironment?.name }}</span> will be copied
              </p>
            </div>
            
            <div class="space-y-2">
              <label for="newEnvironmentName" class="text-sm font-medium text-muted-foreground">New Environment Name</label>
              <Input 
                id="newEnvironmentName" 
                v-model="cloneForm.name" 
                required 
                placeholder="production-2"
                :disabled="environmentActionLoading"
              />
            </div>
            
            <div class="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline"
                @click="cloningEnvironment = null"
                :disabled="environmentActionLoading"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                :loading="environmentActionLoading"
              >
                Clone
              </Button>
            </div>
          </form>
        </Dialog>
      </ClientOnly>
      
      <!-- Delete Environment Confirmation -->
      <ClientOnly>
        <Dialog
          :open="!!deletingEnvironment"
          title="Delete Environment"
          :description="`Are you sure you want to delete the environment ${deletingEnvironment?.name}? This will also delete all variables in this environment.`"
          max-width="sm"
          @close="deletingEnvironment = null"
        >
          <div class="flex justify-end gap-2">
            <Button 
              variant="outline" 
              @click="deletingEnvironment = null"
              :disabled="environmentActionLoading"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              :loading="environmentActionLoading"
              @click="deleteEnvironment"
            >
              Delete
            </Button>
          </div>
        </Dialog>
      </ClientOnly>
      
      <!-- Delete Project Confirmation -->
      <ClientOnly>
        <Dialog
          :open="showDeleteProjectModal"
          title="Delete Project"
          description="This action is irreversible. Type the project name to confirm."
          @close="showDeleteProjectModal = false"
        >
          <div class="space-y-4">
            <div>
              <p class="text-sm text-muted-foreground mb-2">
                Please type <span class="font-medium text-foreground">{{ project.name }}</span> to confirm.
              </p>
              <Input 
                v-model="deleteProjectConfirmation" 
                placeholder="Type project name to confirm"
                :disabled="deleteProjectLoading"
              />
            </div>
            <div class="flex justify-end gap-2">
              <Button 
                variant="outline" 
                @click="showDeleteProjectModal = false"
                :disabled="deleteProjectLoading"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                :disabled="deleteProjectConfirmation.trim() !== project.name || deleteProjectLoading"
                :loading="deleteProjectLoading"
                @click="deleteProject"
              >
                Delete Project
              </Button>
            </div>
          </div>
        </Dialog>
      </ClientOnly>
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import ProtectedEnvironmentSettings from '@/components/environments/ProtectedEnvironmentSettings.vue'
import NamingConventionProjectOverride from '@/components/variables/NamingConventionProjectOverride.vue'
import ProjectServicesSettings from '@/components/services/ProjectServicesSettings.vue'
import type { Database } from '~/types/database.types'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type EnvironmentRow = Database['public']['Tables']['environments']['Row']
type VariableRow = Database['public']['Tables']['variables']['Row']
type EnvironmentApproverRow = Database['public']['Tables']['environment_approvers']['Row']

type EnvironmentMutableField = 'is_protected' | 'approval_mode' | 'auto_expire_hours'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

const router = useRouter()
const route = useRoute()
const projectId = String(route.params.id)
const client = useSupabaseClient()
const user = useSupabaseUser()
const { $toast } = useNuxtApp()
const { checkProjectEnvironmentLimit } = useLimits()

// Breadcrumbs
const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

// Role guard
const orgStore = useOrganizationStore()
const roleLoading = ref(true)
const userRole = ref<string | null>(null)
const isAdmin = computed(() => userRole.value === 'owner' || userRole.value === 'admin')

// State
const loading = ref(true)
const project = ref<ProjectRow | null>(null)
const environments = ref<EnvironmentRow[]>([])
const environmentLoading = ref(false)
const environmentCounts = ref<Record<string, number>>({})

// Update project form - use refs for better SSR hydration
const formName = ref('')
const formDescription = ref('')
const updateLoading = ref(false)

// Environment form
const showAddEnvironmentModal = ref(false)
const editingEnvironment = ref<EnvironmentRow | null>(null)
const environmentForm = reactive({
  name: ''
})
const environmentActionLoading = ref(false)
const deletingEnvironment = ref<EnvironmentRow | null>(null)

// Clone environment
const cloningEnvironment = ref<EnvironmentRow | null>(null)
const cloneForm = reactive({
  name: ''
})

// Approvers state
const approvers = ref<Record<string, EnvironmentApproverRow[]>>({})

// Delete project
const showDeleteProjectModal = ref(false)
const deleteProjectConfirmation = ref('')
const deleteProjectLoading = ref(false)

// Fetch project data
const fetchProject = async () => {
  loading.value = true

  try {
    const { data, error } = await client
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error || !data) {
      $toast.error('Project not found or access denied')
      navigateTo('/dashboard', { replace: true })
      return
    }

    project.value = data
    formName.value = data.name
    formDescription.value = data.description || ''

    // Set breadcrumbs
    breadcrumbs.value = [
      { label: 'Dashboard', to: '/dashboard' },
      { label: data.name, to: `/dashboard/projects/${projectId}` },
      { label: 'Settings' }
    ]
  } catch (error) {
    $toast.error('Project not found or access denied')
    console.error(error)
    navigateTo('/dashboard', { replace: true })
  } finally {
    loading.value = false
  }
}

// Fetch environments and count variables
const fetchEnvironments = async () => {
  environmentLoading.value = true
  
  try {
    const { data, error } = await client
      .from('environments')
      .select('*')
      .eq('project_id', projectId)
      .order('name', { ascending: true })
    
    if (error) throw error
    
    environments.value = data || []

    // Fetch variable counts for each environment
    await Promise.all(environments.value.map(async (env) => {
      const { count, error: countError } = await client
        .from('variables')
        .select('*', { count: 'exact', head: true })
        .eq('environment_id', env.id)

      if (!countError) {
        environmentCounts.value[env.id] = count || 0
      }
    }))

    await fetchApprovers()
  } catch (error) {
    $toast.error('Failed to load environments')
    console.error(error)
  } finally {
    environmentLoading.value = false
  }
}

// Get variable count for an environment
const getVariableCount = (environmentId: string) => {
  return environmentCounts.value[environmentId] || 0
}

// Fetch approvers for all environments
const fetchApprovers = async () => {
  try {
    const envIds = environments.value.map(e => e.id)
    if (envIds.length === 0) return

    const { data, error } = await client
      .from('environment_approvers')
      .select('*')
      .in('environment_id', envIds)

    if (error) throw error

    // Group by environment_id
    approvers.value = {}
    for (const approver of (data || [])) {
      if (!approvers.value[approver.environment_id]) {
        approvers.value[approver.environment_id] = []
      }
      const approverList = approvers.value[approver.environment_id]
      if (approverList) {
        approverList.push(approver)
      }
    }
  } catch (error) {
    console.error('Failed to fetch approvers:', error)
  }
}

const getApproversForEnv = (envId: string): EnvironmentApproverRow[] => {
  return approvers.value[envId] || []
}

const updateEnvProtection = async <K extends EnvironmentMutableField>(
  env: EnvironmentRow,
  field: K,
  value: EnvironmentRow[K]
) => {
  try {
    const { error } = await client
      .from('environments')
      .update({ [field]: value })
      .eq('id', env.id)

    if (error) throw error

    env[field] = value
    $toast.success('Protection settings updated')
  } catch (error) {
    $toast.error('Failed to update settings')
    console.error(error)
  }
}

const addApprover = async (envId: string, userId: string) => {
  try {
    const { error } = await client
      .from('environment_approvers')
      .insert({
        environment_id: envId,
        user_id: userId,
        created_by: user.value?.id ?? user.value?.sub
      })

    if (error) throw error

    await fetchApprovers()
    $toast.success('Approver added')
  } catch (error) {
    $toast.error('Failed to add approver')
    console.error(error)
  }
}

const removeApprover = async (approverId: string) => {
  try {
    const { error } = await client
      .from('environment_approvers')
      .delete()
      .eq('id', approverId)

    if (error) throw error

    await fetchApprovers()
    $toast.success('Approver removed')
  } catch (error) {
    $toast.error('Failed to remove approver')
    console.error(error)
  }
}

const getNextEnvironmentFriendlyId = async (): Promise<number> => {
  const { data, error } = await client
    .from('environments')
    .select('friendly_id')
    .eq('project_id', projectId)
    .order('friendly_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return (data?.friendly_id ?? 0) + 1
}

// Update project
const updateProject = async () => {
  // Validate form
  if (!formName.value.trim()) {
    $toast.error('Project name is required')
    return
  }
  
  updateLoading.value = true
  
  try {
    const { error } = await client
      .from('projects')
      .update({
        name: formName.value.trim(),
        description: formDescription.value.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
    
    if (error) throw error
    
    $toast.success('Project updated successfully')
    await fetchProject()
  } catch (error) {
    $toast.error('Failed to update project')
    console.error(error)
  } finally {
    updateLoading.value = false
  }
}

// Edit environment
const editEnvironment = (environment: EnvironmentRow) => {
  editingEnvironment.value = environment
  environmentForm.name = environment.name
}

// Cancel environment edit
const cancelEnvironmentEdit = () => {
  showAddEnvironmentModal.value = false
  editingEnvironment.value = null
  environmentForm.name = ''
}

// Save environment (add or update)
const saveEnvironment = async () => {
  // Validate form
  if (!environmentForm.name.trim()) {
    $toast.error('Environment name is required')
    return
  }
  
  environmentActionLoading.value = true
  
  try {
    const projectData = project.value
    if (!projectData) {
      throw new Error('Project not loaded')
    }

    if (editingEnvironment.value) {
      // Update existing environment
      const { error } = await client
        .from('environments')
        .update({
          name: environmentForm.name.trim()
        })
        .eq('id', editingEnvironment.value.id)
      
      if (error) throw error
      
      $toast.success(`Environment updated to "${environmentForm.name}"`)
    } else {
      // Check environment limit before creating
      const limitResult = await checkProjectEnvironmentLimit(projectId)
      if (!limitResult.allowed) {
        const event = new CustomEvent('billing:limit-reached', { detail: limitResult })
        window.dispatchEvent(event)
        environmentActionLoading.value = false
        return
      }
      
      // Check if environment with same name already exists
      const { data: existing, error: checkError } = await client
        .from('environments')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', environmentForm.name.trim())
      
      if (checkError) throw checkError
      
      if (existing?.length > 0) {
        $toast.error(`Environment "${environmentForm.name}" already exists`)
        environmentActionLoading.value = false
        return
      }
      
      // Create new environment
      const friendlyId = await getNextEnvironmentFriendlyId()
      const { error } = await client
        .from('environments')
        .insert({
          name: environmentForm.name.trim(),
          project_id: projectId,
          organization_id: projectData.organization_id,
          friendly_id: friendlyId
        })
      
      if (error) throw error
      
      $toast.success(`Environment "${environmentForm.name}" added`)
    }
    
    // Refresh environments
    await fetchEnvironments()
    
    // Reset form and close modal
    environmentForm.name = ''
    showAddEnvironmentModal.value = false
    editingEnvironment.value = null
  } catch (error) {
    $toast.error('Failed to save environment')
    console.error(error)
  } finally {
    environmentActionLoading.value = false
  }
}

// Show clone environment modal
const showCloneEnvironmentModal = (environment: EnvironmentRow) => {
  cloningEnvironment.value = environment
  cloneForm.name = `${environment.name}-clone`
}

// Clone environment
const cloneEnvironment = async () => {
  if (!cloningEnvironment.value) return
  
  // Validate form
  if (!cloneForm.name.trim()) {
    $toast.error('Environment name is required')
    return
  }
  
  environmentActionLoading.value = true
  
  try {
    const projectData = project.value
    if (!projectData) {
      throw new Error('Project not loaded')
    }

    // Check environment limit before cloning
    const limitResult = await checkProjectEnvironmentLimit(projectId)
    if (!limitResult.allowed) {
      const event = new CustomEvent('billing:limit-reached', { detail: limitResult })
      window.dispatchEvent(event)
      environmentActionLoading.value = false
      return
    }
    
    // Check if environment with same name already exists
    const { data: existing, error: checkError } = await client
      .from('environments')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', cloneForm.name.trim())
    
    if (checkError) throw checkError
    
    if (existing?.length > 0) {
      $toast.error(`Environment "${cloneForm.name}" already exists`)
      environmentActionLoading.value = false
      return
    }
    
    // Create new environment
    const friendlyId = await getNextEnvironmentFriendlyId()
    const { data: newEnv, error: envError } = await client
      .from('environments')
      .insert({
        name: cloneForm.name.trim(),
        project_id: projectId,
        organization_id: projectData.organization_id,
        friendly_id: friendlyId
      })
      .select()
      .single()
    
    if (envError) throw envError
    
    // Get variables from source environment
    const { data: sourceVariables, error: varsError } = await client
      .from('variables')
      .select('*')
      .eq('environment_id', cloningEnvironment.value.id)
    
    if (varsError) throw varsError
    
    if (sourceVariables?.length > 0) {
      // For secret variables, decrypt the value first (secrets are stored in vault)
      const variablesToInsert = await Promise.all(
        sourceVariables.map(async (v) => {
          let value = v.value
          if (v.is_secret) {
            const { data: decrypted } = await client.rpc('decrypt_variable_value', { variable_id: v.id })
            value = decrypted
          }
          return {
            organization_id: projectData.organization_id,
            environment_id: newEnv.id,
            key: v.key,
            value,
            is_secret: v.is_secret
          }
        })
      )
      
      const { error: insertError } = await client
        .from('variables')
        .insert(variablesToInsert)
      
      if (insertError) throw insertError
    }
    
    $toast.success(`Environment "${cloningEnvironment.value.name}" cloned to "${cloneForm.name}"`)
    
    // Refresh environments
    await fetchEnvironments()
    
    // Reset form and close modal
    cloningEnvironment.value = null
    cloneForm.name = ''
  } catch (error) {
    $toast.error('Failed to clone environment')
    console.error(error)
  } finally {
    environmentActionLoading.value = false
  }
}

// Toggle show_values_to_readers
const toggleShowValuesToReaders = async (env: EnvironmentRow) => {
  try {
    const newValue = !env.show_values_to_readers
    const { error } = await client
      .from('environments')
      .update({ show_values_to_readers: newValue })
      .eq('id', env.id)

    if (error) throw error

    env.show_values_to_readers = newValue
    $toast.success(newValue ? 'Read-only users can now see values' : 'Values hidden from read-only users')
  } catch (error) {
    $toast.error('Failed to update setting')
    console.error(error)
  }
}

// Delete environment confirm
const deleteEnvironmentConfirm = (environment: EnvironmentRow) => {
  if (environments.value.length <= 1) {
    $toast.error('Cannot delete the last environment')
    return
  }
  
  deletingEnvironment.value = environment
}

// Delete environment
const deleteEnvironment = async () => {
  if (!deletingEnvironment.value) return
  
  environmentActionLoading.value = true
  
  try {
    // Delete variables first (cascade would work in a real DB)
    const { error: varsError } = await client
      .from('variables')
      .delete()
      .eq('environment_id', deletingEnvironment.value.id)
    
    if (varsError) throw varsError
    
    // Delete environment
    const { error } = await client
      .from('environments')
      .delete()
      .eq('id', deletingEnvironment.value.id)
    
    if (error) throw error
    
    $toast.success(`Environment "${deletingEnvironment.value.name}" deleted`)
    
    // Refresh environments
    await fetchEnvironments()
    
    // Reset state
    deletingEnvironment.value = null
  } catch (error) {
    $toast.error('Failed to delete environment')
    console.error(error)
  } finally {
    environmentActionLoading.value = false
  }
}

// Delete project
const deleteProject = async () => {
  if (!project.value || deleteProjectConfirmation.value.trim() !== project.value.name) return
  
  deleteProjectLoading.value = true
  
  try {
    // In a real app with proper DB relations, you'd just delete the project
    // and let cascading deletes handle the rest
    
    // First, get all environments
    const { data: envs, error: envsError } = await client
      .from('environments')
      .select('id')
      .eq('project_id', projectId)
    
    if (envsError) throw envsError
    
    // Delete all variables for those environments
    if (envs?.length > 0) {
      const envIds = envs.map(e => e.id)
      
      const { error: varsError } = await client
        .from('variables')
        .delete()
        .in('environment_id', envIds)
      
      if (varsError) throw varsError
      
      // Delete all environments
      const { error: deleteEnvsError } = await client
        .from('environments')
        .delete()
        .eq('project_id', projectId)
      
      if (deleteEnvsError) throw deleteEnvsError
    }
    
    // Finally delete the project
    const { error } = await client
      .from('projects')
      .delete()
      .eq('id', projectId)
    
    if (error) throw error
    
    $toast.success(`Project "${project.value.name}" deleted`)
    router.push('/dashboard')
  } catch (error) {
    $toast.error('Failed to delete project')
    console.error(error)
  } finally {
    deleteProjectLoading.value = false
  }
}

// Fetch user role
const fetchRole = async (organizationId?: string | null) => {
  const orgId = organizationId || project.value?.organization_id || orgStore.selectedOrganizationId
  if (!orgId) {
    userRole.value = null
    roleLoading.value = false
    return
  }

  let uid = user.value?.id ?? user.value?.sub
  if (!uid) {
    const { data } = await client.auth.getUser()
    uid = data.user?.id
  }

  if (!uid) {
    userRole.value = null
    roleLoading.value = false
    return
  }

  roleLoading.value = true
  const { data } = await client
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', uid)
    .maybeSingle()

  userRole.value = data?.role ?? null
  roleLoading.value = false
}

// Fetch data on mount
onMounted(async () => {
  await fetchProject()
  await fetchRole(project.value?.organization_id)
  if (isAdmin.value) {
    await fetchEnvironments()
  }
})
</script>
