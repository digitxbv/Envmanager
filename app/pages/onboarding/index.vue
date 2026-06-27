<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-4">
    <div class="w-full max-w-md text-center space-y-5">
      <div class="flex justify-center">
        <Icon name="lucide:loader-circle" class="h-8 w-8 animate-spin text-primary" />
      </div>
      <div class="space-y-1.5">
        <h1 class="text-2xl font-semibold text-foreground">Setting up your workspace</h1>
        <p class="text-sm text-muted-foreground">This only takes a second — we're creating your first project.</p>
      </div>
      <div v-if="errorMessage" class="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
        {{ errorMessage }}
        <Button class="mt-3 w-full" :loading="isLoading" @click="runSetup">Try again</Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

definePageMeta({ layout: false, middleware: 'auth' })
useHead({ title: 'Set up your workspace — EnvManager' })

const client = useSupabaseClient()
const router = useRouter()
const { track } = usePostHog()

const isLoading = ref(false)
const errorMessage = ref('')
const onboardingStartTime = ref<number>(0)

const defaultOrgName = (email?: string | null): string => {
  const local = (email || '').split('@')[0]?.replace(/[._-]+/g, ' ').trim()
  if (!local) return 'My Workspace'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

const runSetup = async () => {
  if (isLoading.value) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    const { data: { user: authUser } } = await client.auth.getUser()
    if (!authUser) { await router.push('/auth/login'); return }

    // Skip if the user already has an org
    const { data: existing } = await client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', authUser.id)
      .limit(1)
    if (existing && existing.length > 0) { await router.push('/dashboard'); return }

    // 1. Organization (RPC also creates the trial subscription via trigger)
    const orgName = defaultOrgName(authUser.email)
    const { data: organizations, error: orgError } = await client
      .rpc('create_organization_with_owner', { org_name: orgName })
    if (orgError) throw orgError
    const organization = organizations?.[0]
    if (!organization) throw new Error('Failed to create organization')

    // 2. Project
    const { data: project, error: projectError } = await client
      .from('projects')
      .insert({ name: 'My First Project', organization_id: organization.id, friendly_id: 1 })
      .select()
      .single()
    if (projectError) throw projectError

    // 3. Environments (Development + Production)
    const { error: envError } = await client.from('environments').insert([
      { project_id: project.id, organization_id: organization.id, name: 'development', friendly_id: 1 },
      { project_id: project.id, organization_id: organization.id, name: 'production', friendly_id: 2 },
    ])
    if (envError) throw envError

    // 4. Store org + analytics
    useOrganizationStore().setOrganizations([organization])
    track('project_created', { project_id: project.id, source: 'onboarding' })
    track('onboarding_completed', {
      timestamp: new Date().toISOString(),
      total_time_seconds: Math.round((Date.now() - onboardingStartTime.value) / 1000),
      organization_name: orgName,
      project_name: 'My First Project',
      environments_count: 2,
      auto_setup: true,
    })

    // Fire-and-forget welcome email — must never block or fail the redirect.
    client.functions.invoke('send-lifecycle-email', { body: { email_type: 'welcome' } })
      .catch((e) => console.warn('welcome email invoke failed', e))

    await router.push(`/dashboard/projects/${project.id}?firstrun=1`)
  } catch (error) {
    console.error('Onboarding error:', error)
    errorMessage.value = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  onboardingStartTime.value = Date.now()
  track('onboarding_started', { timestamp: new Date().toISOString(), auto_setup: true })
  runSetup()
})
</script>
