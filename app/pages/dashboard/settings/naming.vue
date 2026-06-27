<template>
  <div class="space-y-6">
    <!-- Loading -->
    <LoadingSpinner v-if="loading" class="py-20" />

    <!-- Access Restricted for non-admins -->
    <Card v-else-if="!isAdmin" class-name="text-center">
      <EmptyState
        icon="lucide:lock"
        title="Access Restricted"
        description="Only organization owners and admins can manage naming conventions."
      />
    </Card>

    <!-- Naming Conventions Settings -->
    <Card v-else-if="selectedOrganizationId">
      <NamingConventionsSettings
        :organization-id="selectedOrganizationId"
      />
    </Card>
  </div>
</template>

<script setup lang="ts">
import NamingConventionsSettings from '@/components/settings/NamingConventionsSettings.vue'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

// =====================================================
// Core Composables
// =====================================================

const organizationStore = useOrganizationStore()
const user = useSupabaseUser()
const { getCurrentUserRole } = useTeamManagement()

// =====================================================
// Reactive State
// =====================================================

const selectedOrganizationId = computed(() => organizationStore.selectedOrganizationId)
const loading = ref(true)
const currentUserRole = ref<string | null>(null)

const isAdmin = computed(() =>
  currentUserRole.value === 'owner' || currentUserRole.value === 'admin'
)

// =====================================================
// Lifecycle
// =====================================================

watch(
  [selectedOrganizationId, user],
  async ([orgId, currentUser]) => {
    const userId = currentUser?.id ?? currentUser?.sub
    if (!orgId || !userId) return

    loading.value = true
    try {
      currentUserRole.value = await getCurrentUserRole(orgId)
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)
</script>
