<template>
  <div class="px-4 md:px-6 lg:px-8 py-6 max-w-3xl">
    <div class="space-y-6">
      <!-- Header -->
      <PageHeader title="New Project" description="Set up a new project to organize your environment variables" />
      
      <!-- Form Card -->
      <Card>
        <form @submit.prevent="createProject" class="space-y-6">
          <div class="space-y-4">
            <div class="space-y-2">
              <label for="name" class="text-sm font-medium text-muted-foreground">Project Name</label>
              <Input 
                id="name" 
                v-model="form.name" 
                required 
                placeholder="My Awesome Project"
                :disabled="loading"
                aria-label="Project name"
              />
            </div>
            
            <div class="space-y-2">
              <label for="description" class="text-sm font-medium text-muted-foreground">Description</label>
              <textarea
                id="description"
                v-model="form.description"
                rows="3"
                placeholder="A brief description of your project"
                class="flex w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-ring/50 focus:border-ring transition-all duration-200"
                :disabled="loading"
                aria-label="Project description"
              />
              <p class="text-xs text-muted-foreground">
                Optional: Add a description to help your team understand the project's purpose
              </p>
            </div>
            
            <div class="space-y-3">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label class="text-sm font-medium text-muted-foreground">Default Environments</label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  @click="addCustomEnvironment"
                  :disabled="loading"
                >
                  <Icon name="lucide:plus" class="h-4 w-4 mr-2" />
                  Add Custom
                </Button>
              </div>
              
              <div class="rounded-md border border-border bg-muted/30 divide-y divide-border">
                <div 
                  v-for="(env, index) in form.environments" 
                  :key="index"
                  class="flex items-center gap-3 p-3"
                >
                  <div v-if="!env.custom" class="flex items-center gap-3 flex-1">
                    <input
                      :id="`environment-${index}`"
                       v-model="form.environments[index]!.selected"
                      type="checkbox"
                      :disabled="loading"
                      class="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    >
                    <label
                      :for="`environment-${index}`"
                      class="text-sm font-medium text-muted-foreground cursor-pointer"
                    >
                      {{ env.name }}
                    </label>
                  </div>
                  <div v-else class="flex-1">
                      <Input 
                       v-model="form.environments[index]!.name" 
                      :disabled="loading"
                      placeholder="Environment name"
                      :aria-label="'Environment ' + (index + 1) + ' name'"
                    />
                  </div>
                  <Button 
                    v-if="env.custom"
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    @click="removeEnvironment(index)"
                    :disabled="loading"
                    class="flex-shrink-0"
                  >
                    <Icon name="lucide:trash" class="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <p class="text-xs text-muted-foreground">
                Toggle default environments on or off, and add custom ones. At least one environment is required.
              </p>
            </div>
          </div>
          
          <div class="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              @click="$router.back()"
              :disabled="loading"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              :loading="loading"
            >
              Create Project
            </Button>
          </div>
        </form>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { useFormLoading } from '~/composables/useFormLoading'
import type { LimitCheckResult } from '~/types/billing.types'

const router = useRouter()
const client = useSupabaseClient()
const { $toast } = useNuxtApp()
const { track } = usePostHog()

// Breadcrumbs
const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))
breadcrumbs.value = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'New Project' }
]

const { isLoading, isDisabled, withLoading } = useFormLoading()
const loading = isLoading

// Get selected organization from store
const orgStore = useOrganizationStore()
const { selectedOrganizationId } = storeToRefs(orgStore)

// Billing limits
const { enforceLimit } = useLimits()
const billingStore = useBillingStore()
const { fetchSubscription } = useBilling()

// Form state
const form = reactive({
  name: '',
  description: '',
  environments: [
    { name: 'development', custom: false, selected: true },
    { name: 'staging', custom: false, selected: true },
    { name: 'production', custom: false, selected: true }
  ]
})

// Add custom environment
const addCustomEnvironment = () => {
  form.environments.push({ name: '', custom: true, selected: true })
}

// Remove environment
const removeEnvironment = (index: number) => {
  form.environments.splice(index, 1)
}

const getNextProjectFriendlyId = async (organizationId: string): Promise<number> => {
  const { data, error } = await client
    .from('projects')
    .select('friendly_id')
    .eq('organization_id', organizationId)
    .order('friendly_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data?.friendly_id ?? 0) + 1
}

// Create project
const createProject = async () => {
  // Check project limit FIRST (before any validation)
  const allowed = await enforceLimit('projects')
  if (!allowed) return

  // Validate form
  if (!form.name.trim()) {
    $toast.error('Project name is required')
    return
  }

  // Validate project name length and characters
  if (form.name.trim().length < 3) {
    $toast.error('Project name must be at least 3 characters')
    return
  }

  if (form.name.trim().length > 100) {
    $toast.error('Project name must not exceed 100 characters')
    return
  }

  if (!/^[a-zA-Z0-9\s\-_]+$/.test(form.name.trim())) {
    $toast.error('Project name contains invalid characters. Use only letters, numbers, spaces, hyphens, and underscores.')
    return
  }

  // Validate environments
  const validEnvironments = form.environments.filter(env => env.selected && env.name.trim())
  if (validEnvironments.length === 0) {
    $toast.error('At least one environment is required')
    return
  }

  // Check environment limit before project creation
  // Since project doesn't exist yet, check against plan limit directly
  if (!billingStore.subscription) {
    await fetchSubscription()
  }
  const subscription = billingStore.subscription as { plan?: { limits?: Record<string, number> } } | null
  const limits = subscription?.plan?.limits
  const envLimit = limits?.environments_per_project ?? 3

  if (envLimit !== -1 && validEnvironments.length > envLimit) {
    // Trigger modal manually since we can't use checkProjectEnvironmentLimit without a project ID
    const limitResult: LimitCheckResult = {
      allowed: false,
      limit: envLimit,
      current: 0,
      remaining: envLimit,
      limitType: 'environments_per_project',
      isUnlimited: false
    }
    window.dispatchEvent(new CustomEvent('billing:limit-reached', { detail: limitResult }))
    return
  }

  // Check if organization is selected
  if (!selectedOrganizationId.value) {
    $toast.error('No organization selected')
    return
  }

  const orgId = selectedOrganizationId.value

  await withLoading(async () => {
    const nextProjectFriendlyId = await getNextProjectFriendlyId(orgId)

    // Create project with selected organization
    const { data: project, error: projectError } = await client
      .from('projects')
      .insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        organization_id: orgId,
        friendly_id: nextProjectFriendlyId
      })
      .select()
      .single()

    if (projectError) {
      if (projectError.code === '42P17') {
        throw new Error('Database security policy error. Please contact support.')
      }
      throw projectError
    }

    // Create environments
    const environmentsToCreate = validEnvironments.map((env, index) => ({
      name: env.name.trim(),
      project_id: project.id,
        organization_id: orgId,
      friendly_id: index + 1
    }))

    const { error: environmentsError } = await client
      .from('environments')
      .insert(environmentsToCreate)

    if (environmentsError) throw environmentsError

    // Track project creation
    track('project_created', {
      project_name: form.name.trim(),
      environments_count: validEnvironments.length
    })

    $toast.success(`Project "${form.name}" created successfully!`)
    await router.push(`/dashboard/projects/${project.id}`)
  })
}
</script>
