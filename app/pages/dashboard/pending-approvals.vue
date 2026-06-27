<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <div class="space-y-6">
      <!-- Header -->
      <PageHeader title="Pending Approvals" description="Review and approve pending changes for protected environments" />

      <!-- Loading state -->
      <LoadingSpinner v-if="roleLoading" class="py-20" />

      <!-- Non-admin message -->
      <EmptyState
        v-else-if="!isAdmin"
        icon="lucide:shield-alert"
        title="Admin access required"
        description="Only organization admins and owners can manage pending approvals."
      />

       <!-- Admin content -->
       <template v-else>
         <LoadingSpinner v-if="loading" class="py-20" />

        <EmptyState
          v-else-if="pendingChanges.length === 0"
          icon="lucide:check-circle"
          title="No pending approvals"
          description="All changes have been reviewed. You're all caught up."
        />

        <Card v-else padding="sm" class-name="!p-0 overflow-hidden">
          <PendingChangesList
            :changes="pendingChanges"
            :current-user-id="userId"
            :is-loading="loading"
            :show-context="true"
            :can-approve="true"
            @approve="openReviewModal($event, 'approve')"
            @reject="openReviewModal($event, 'reject')"
            @cancel="handleCancelChange"
          />
        </Card>
      </template>

      <ClientOnly>
        <PendingChangeReviewModal
          :is-open="showReviewModal"
          :change="reviewingChange"
          :mode="reviewMode"
          @close="showReviewModal = false"
          @confirm="handleReviewConfirm"
        />
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import PendingChangesList from '@/components/environments/PendingChangesList.vue'
import PendingChangeReviewModal from '@/components/environments/PendingChangeReviewModal.vue'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

const user = useSupabaseUser()
const client = useSupabaseClient()
const { $toast } = useNuxtApp()
const orgStore = useOrganizationStore()

const userId = computed(() => user.value?.id ?? user.value?.sub ?? '')
const organizationId = computed(() => orgStore.selectedOrganizationId)

// Role guard
const userRole = ref<string | null>(null)
const roleLoading = ref(true)
const isAdmin = computed(() => userRole.value === 'owner' || userRole.value === 'admin')

const fetchRole = async () => {
  const currentOrgId = organizationId.value
  if (!currentOrgId) {
    userRole.value = null
    roleLoading.value = false
    return
  }

  const uid = userId.value
  if (!uid) {
    roleLoading.value = false
    return
  }

  roleLoading.value = true
  const { data } = await client
    .from('organization_members')
    .select('role')
    .eq('organization_id', currentOrgId)
    .eq('user_id', uid)
    .maybeSingle()

  userRole.value = data?.role ?? null
  roleLoading.value = false
}

const {
  pendingChanges,
  isLoading: loading,
  fetchPendingChanges,
  approve: approvePendingChange,
  reject: rejectPendingChange,
  cancelChange
} = usePendingChanges()

// Review modal state
const showReviewModal = ref(false)
const reviewingChange = ref<any>(null)
const reviewMode = ref<'approve' | 'reject'>('approve')

// Open review modal
const openReviewModal = (change: any, mode: 'approve' | 'reject') => {
  reviewingChange.value = change
  reviewMode.value = mode
  showReviewModal.value = true
}

// Handle review confirm
const handleReviewConfirm = async (reason?: string) => {
  if (!reviewingChange.value) return

  try {
    if (reviewMode.value === 'approve') {
      await approvePendingChange(reviewingChange.value.id)
    } else {
      await rejectPendingChange(reviewingChange.value.id, reason)
    }

    showReviewModal.value = false
    reviewingChange.value = null
    await fetchPendingChanges(undefined, organizationId.value ?? undefined)
  } catch (error) {
    // Error handled by composable
  }
}

// Handle cancel change
const handleCancelChange = async (changeId: string) => {
  try {
    await cancelChange(changeId)
    await fetchPendingChanges(undefined, organizationId.value ?? undefined)
  } catch (error) {
    // Error handled by composable
  }
}

onMounted(() => {
  breadcrumbs.value = [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Pending Approvals' }
  ]
})

// Fetch role and pending changes on mount and when org changes
watch(organizationId, async (newOrgId) => {
  await fetchRole()
  if (newOrgId && isAdmin.value) {
    fetchPendingChanges(undefined, newOrgId)
  }
}, { immediate: true })
</script>
