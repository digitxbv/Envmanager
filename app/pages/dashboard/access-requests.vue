<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <div class="space-y-6">
      <!-- Header -->
      <PageHeader title="Access Requests" description="Review and manage secret access requests for your organization" />

      <!-- Loading state -->
      <LoadingSpinner v-if="roleLoading" class="py-20" />

      <!-- Non-admin message -->
      <EmptyState
        v-else-if="!isAdmin"
        icon="lucide:shield-alert"
        title="Admin access required"
        description="Only organization admins and owners can manage access requests."
      />

      <!-- Admin content -->
      <AccessRequestsList v-else :organization-id="orgId" />
    </div>
  </div>
</template>

<script setup lang="ts">
import AccessRequestsList from '@/components/encrypted/AccessRequestsList.vue'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

useHead({
  title: 'Access Requests - EnvManager',
  meta: [
    {
      name: 'description',
      content: 'Review and manage secret access requests for your organization'
    }
  ]
})

const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

const user = useSupabaseUser()
const client = useSupabaseClient()
const orgStore = useOrganizationStore()

const orgId = computed(() => orgStore.selectedOrganizationId || '')
const userRole = ref<string | null>(null)
const roleLoading = ref(true)

const isAdmin = computed(() => userRole.value === 'owner' || userRole.value === 'admin')

const fetchRole = async () => {
  const currentOrgId = orgId.value
  if (!currentOrgId) {
    userRole.value = null
    roleLoading.value = false
    return
  }

  const userId = user.value?.id ?? user.value?.sub
  if (!userId) {
    roleLoading.value = false
    return
  }

  roleLoading.value = true
  const { data } = await client
    .from('organization_members')
    .select('role')
    .eq('organization_id', currentOrgId)
    .eq('user_id', userId)
    .maybeSingle()

  userRole.value = data?.role ?? null
  roleLoading.value = false
}

onMounted(() => {
  breadcrumbs.value = [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Access Requests' }
  ]
})

// Watch for org changes
watch(orgId, () => {
  fetchRole()
}, { immediate: true })
</script>
