<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-2">
      <h3 class="text-lg font-semibold">Pending Access Requests</h3>
      <span
        v-if="pendingCount > 0"
        class="bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400 rounded-full px-2.5 py-0.5 text-xs font-medium"
      >
        {{ pendingCount }}
      </span>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="pendingRequests.length === 0"
      class="text-center py-8 text-muted-foreground"
    >
      <Icon name="lucide:check-circle" class="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>No pending access requests</p>
    </div>

    <!-- Request Cards -->
    <div v-else class="space-y-3">
      <div
        v-for="request in pendingRequests"
        :key="request.id"
        class="border rounded-lg p-4"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">{{ request.requester_email }}</p>
            <p class="text-sm text-muted-foreground">
              Requested access to <span class="font-semibold">{{ request.variable_key }}</span>
              in <span class="font-semibold">{{ request.project_name }}</span> / <span class="font-semibold">{{ request.environment_name }}</span>
            </p>
            <p v-if="request.request_reason" class="text-sm mt-2">
              {{ request.request_reason }}
            </p>
            <p class="text-xs text-muted-foreground mt-2">
              {{ formatRelativeTime(request.requested_at) }}
            </p>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              @click="openDenyModal(request)"
            >
              Deny
            </Button>
            <Button
              size="sm"
              @click="openGrantModal(request)"
            >
              Approve
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Grant Access Modal -->
    <GrantAccessModal
      v-model="showGrantModal"
      :request="selectedRequest"
      :approve-fn="approve"
      @granted="handleGranted"
    />

    <!-- Deny Access Modal -->
    <DenyAccessModal
      v-model="showDenyModal"
      :request="selectedRequest"
      :deny-fn="deny"
      @denied="handleDenied"
    />
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import GrantAccessModal from '@/components/encrypted/GrantAccessModal.vue'
import DenyAccessModal from '@/components/encrypted/DenyAccessModal.vue'
import { useAccessRequestsAdmin } from '@/composables/useTemporaryAccess'

interface EnrichedRequest {
  id: string
  variable_id: string
  environment_id: string
  organization_id: string
  requested_by: string
  requested_at: string
  request_reason: string
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'revoked'
  reviewed_by: string | null
  reviewed_at: string | null
  denial_reason: string | null
  access_duration_minutes: number | null
  access_expires_at: string | null
  reveal_count: number
  max_reveals: number
  requester_email: string
  variable_key: string
  project_name: string
  environment_name: string
}

const props = defineProps<{
  organizationId: string
}>()

const organizationIdRef = computed(() => props.organizationId)

const {
  pendingRequests,
  pendingCount,
  isLoading,
  approve,
  deny,
  refresh
} = useAccessRequestsAdmin(organizationIdRef)

const selectedRequest = ref<EnrichedRequest | null>(null)
const showGrantModal = ref(false)
const showDenyModal = ref(false)

const openGrantModal = (request: EnrichedRequest) => {
  selectedRequest.value = request
  showGrantModal.value = true
}

const openDenyModal = (request: EnrichedRequest) => {
  selectedRequest.value = request
  showDenyModal.value = true
}

const handleGranted = () => {
  showGrantModal.value = false
  selectedRequest.value = null
  refresh()
}

const handleDenied = () => {
  showDenyModal.value = false
  selectedRequest.value = null
  refresh()
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  return date.toLocaleDateString()
}
</script>
