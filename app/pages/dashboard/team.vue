<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <div class="space-y-6">
      <!-- Header -->
      <PageHeader title="Team" description="Invite team members and manage their access to your organization" />

      <!-- Invite Section (Owner/Admin only) -->
      <Card v-if="canManageTeam">
        <template #header>
          <h2 class="text-base font-semibold text-foreground">Invite Team Member</h2>
        </template>
        <form @submit.prevent="handleSendInvitation" class="space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-muted-foreground mb-2">
                Email Address
              </label>
              <Input
                v-model="inviteForm.email"
                type="email"
                placeholder="colleague@example.com"
                :disabled="isInviting"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-muted-foreground mb-2">
                Role
              </label>
              <Select
                v-model="inviteForm.role"
                :options="roleOptions"
                :disabled="isInviting"
                placeholder="Select a role..."
              />
            </div>
          </div>
          <Button
            type="submit"
            :loading="isInviting"
            :disabled="!inviteForm.email || !selectedOrganizationId"
          >
            <Icon name="lucide:mail" class="mr-2 h-4 w-4" />
            Send Invitation
          </Button>
        </form>
      </Card>

      <!-- Pending Invitations (Owner/Admin only) -->
      <Card v-if="canManageTeam" padding="sm" class="!p-0 overflow-hidden">
        <template #header>
          <div class="px-6 pt-6">
            <h2 class="text-base font-semibold text-foreground">Pending Invitations</h2>
          </div>
        </template>
        <DataTable
          :columns="invitationColumns"
          :data="invitations"
          :loading="invitationsLoading"
          class="!border-0 !rounded-none [&_table]:min-w-[680px]"
        >
          <template #empty>
            <EmptyState
              icon="lucide:mail-open"
              title="No pending invitations"
              description="Invitations you send will appear here until they're accepted."
            />
          </template>

          <template #cell-email="{ row }">
            <span class="font-medium text-foreground">{{ row.email }}</span>
          </template>

          <template #cell-role="{ row }">
            <Badge :variant="getRoleBadgeVariant(row.role)">
              {{ formatRoleLabel(row.role) }}
            </Badge>
          </template>

          <template #cell-invited_by="{ row }">
            <span class="text-sm text-muted-foreground">{{ row.invited_by_email }}</span>
          </template>

          <template #cell-expires="{ row }">
            <span class="text-sm text-muted-foreground">{{ formatExpiry(row.expires_at) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex items-center gap-2">
              <button
                @click="handleResendInvitation(row.id)"
                :disabled="isResending"
                class="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Resend invitation"
              >
                <Icon name="lucide:refresh-cw" class="h-4 w-4" />
              </button>
              <button
                @click="handleCancelInvitation(row.id)"
                :disabled="isCanceling"
                class="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Cancel invitation"
              >
                <Icon name="lucide:x-circle" class="h-4 w-4" />
              </button>
            </div>
          </template>
        </DataTable>
      </Card>

      <!-- Team Members -->
      <Card padding="sm" class="!p-0 overflow-hidden">
        <template #header>
          <div class="px-6 pt-6">
            <h2 class="text-base font-semibold text-foreground">Team Members</h2>
          </div>
        </template>
        <DataTable
          :columns="memberColumns"
          :data="teamMembers"
          :loading="teamLoading"
          class="!border-0 !rounded-none [&_table]:min-w-[760px]"
        >
          <template #empty>
            <EmptyState
              icon="lucide:users"
              title="No team members yet"
              description="Invite your first team member to start collaborating."
            />
          </template>

          <template #cell-member="{ row }">
            <div class="flex items-center gap-3">
              <Avatar :email="row.email" size="sm" />
              <span class="font-medium text-foreground">{{ row.email }}</span>
            </div>
          </template>

          <template #cell-role="{ row }">
            <Badge :variant="getRoleBadgeVariant(row.role)">
              {{ formatRoleLabel(row.role) }}
            </Badge>
          </template>

          <template #cell-joined="{ row }">
            <span class="text-sm text-muted-foreground">{{ formatDate(row.created_at) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div v-if="canManageMember(row)" class="flex items-center gap-2">
              <Select
                v-if="canEditMemberRole(row)"
                :model-value="row.role"
                :options="memberRoleOptions"
                class="w-28"
                @update:model-value="(val: string) => handleUpdateRole({ memberId: row.id, newRole: val })"
              />
              <Tooltip content="Manage environment access for this member">
                <Button
                  variant="outline"
                  size="sm"
                  @click="handleManageAccess({ member: row })"
                >
                  Access
                </Button>
              </Tooltip>
              <Tooltip content="Remove this member from the organization">
                <Button
                  variant="destructive"
                  size="sm"
                  :disabled="isLastOwner(row)"
                  @click="handleRemoveMember({ memberId: row.id })"
                >
                  Remove
                </Button>
              </Tooltip>
            </div>
          </template>
        </DataTable>
      </Card>
    </div>

    <!-- Environment Access Modal -->
    <ClientOnly>
      <EnvironmentAccessModal
        :open="selectedMember !== null"
        :member="selectedMember"
        :environments="environments"
        :organization-id="selectedOrganizationId ?? ''"
        @close="selectedMember = null"
        @save="handleSaveEnvironmentAccess"
      />

      <!-- Cancel Invitation Dialog -->
      <Dialog
        :open="showCancelInvitationDialog"
        title="Cancel Invitation"
        description="Are you sure you want to cancel this invitation? The invite link will no longer work."
        @close="showCancelInvitationDialog = false"
      >
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="showCancelInvitationDialog = false">Cancel</Button>
          <Button variant="destructive" :loading="isCanceling" @click="confirmCancelInvitation">Confirm</Button>
        </div>
      </Dialog>

      <!-- Remove Member Dialog -->
      <Dialog
        :open="showRemoveMemberDialog"
        title="Remove Team Member"
        description="Are you sure you want to remove this team member? They will lose access to all projects."
        @close="showRemoveMemberDialog = false"
      >
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="showRemoveMemberDialog = false">Cancel</Button>
          <Button variant="destructive" @click="confirmRemoveMember">Confirm</Button>
        </div>
      </Dialog>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import Input from '@/components/ui/Input.vue'
import Dialog from '@/components/ui/Dialog.vue'
import EnvironmentAccessModal from '@/components/settings/EnvironmentAccessModal.vue'
import type { TeamMember, Invitation } from '~/composables/useTeamManagement'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

useHead({
  title: 'Team Management - EnvManager',
  meta: [
    {
      name: 'description',
      content: 'Invite team members and manage their access to your organization'
    }
  ]
})

// =====================================================
// Breadcrumbs
// =====================================================

const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

onMounted(() => {
  breadcrumbs.value = [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Team' }
  ]
})

// =====================================================
// Table Columns & Role Helpers
// =====================================================

const invitationColumns = [
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'invited_by', label: 'Invited By' },
  { key: 'expires', label: 'Expires' },
  { key: 'actions', label: 'Actions', class: 'w-24' }
]

const memberColumns = [
  { key: 'member', label: 'Member' },
  { key: 'role', label: 'Role' },
  { key: 'joined', label: 'Joined' },
  { key: 'actions', label: 'Actions' }
]

const roleOptions = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
  { value: 'viewer', label: 'Viewer' }
]

const memberRoleOptions = [
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' }
]

const getRoleBadgeVariant = (role: string): string => {
  switch (role) {
    case 'owner': return 'success'
    case 'admin': return 'success'
    case 'viewer': return 'default'
    default: return 'outline'
  }
}

const formatRoleLabel = (role: string): string => {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

const canManageMember = (member: TeamMember): boolean => {
  return currentUserRole.value === 'owner' || currentUserRole.value === 'admin'
}

const canEditMemberRole = (member: TeamMember): boolean => {
  if (currentUserRole.value === 'owner') return true
  if (currentUserRole.value === 'admin' && member.role !== 'owner') return true
  return false
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} ${months === 1 ? 'month' : 'months'} ago`
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// =====================================================
// Core Composables
// =====================================================

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { $toast } = useNuxtApp()
const organizationStore = useOrganizationStore()
const { track } = usePostHog()
const { fetchSubscription } = useBilling()
const {
  members: teamMembers,
  loading: teamLoading,
  invitations,
  invitationsLoading,
  fetchMembers,
  fetchInvitations,
  sendInvitation,
  cancelInvitation,
  resendInvitation,
  updateMemberRole,
  removeMember,
  updateEnvironmentAccess
} = useTeamManagement()

// =====================================================
// Reactive State
// =====================================================

const selectedMember = ref<TeamMember | null>(null)
const environments = ref<Array<{ id: string; name: string; project_id: string; project_name: string }>>([])
const currentUserRole = ref<'owner' | 'admin' | 'member' | 'viewer'>('member')
const isInviting = ref(false)
const isResending = ref(false)
const isCanceling = ref(false)

const inviteForm = ref({
  email: '',
  role: 'member' as 'member' | 'admin' | 'viewer'
})

// Dialog state for confirmations
const showCancelInvitationDialog = ref(false)
const pendingInvitationId = ref<string | null>(null)
const showRemoveMemberDialog = ref(false)
const pendingMemberId = ref<string | null>(null)

// =====================================================
// Computed Properties
// =====================================================

const selectedOrganizationId = computed(() => organizationStore.selectedOrganizationId)

// Only owners and admins can invite/manage team members
const canManageTeam = computed(() =>
  currentUserRole.value === 'owner' || currentUserRole.value === 'admin'
)

// =====================================================
// Methods - Data Loading
// =====================================================

const loadTeamData = async (orgId: string) => {
  if (!orgId) return

  try {
    // subscription, members, invitations and environments are independent (all keyed
    // off orgId). Run them in parallel instead of a sequential waterfall — over a
    // transatlantic link that turns 4 round-trips into 1.
    const [, , , envRes] = await Promise.all([
      fetchSubscription(orgId),       // required for limit checking
      fetchMembers(orgId),            // team members
      fetchInvitations(orgId),        // pending invitations
      supabase                        // environments for the access modal (with project names)
        .from('environments')
        .select('id, name, project_id, projects(name)')
        .eq('organization_id', orgId)
        .order('project_id', { ascending: true })
        .order('name', { ascending: true }),
    ])

    // Current user's role — derived from the members list populated by fetchMembers above.
    const userId = user.value?.id ?? user.value?.sub
    const currentMember = teamMembers.value.find(m => m.user_id === userId)
    if (currentMember) {
      currentUserRole.value = currentMember.role
    }

    const { data, error } = envRes

    if (error) throw error

    // Map to flat structure with project_name
    environments.value = (data || []).map(env => ({
      id: env.id,
      name: env.name,
      project_id: env.project_id,
      project_name: (env.projects as { name: string } | null)?.name || 'Unknown Project'
    }))
  } catch (error) {
    console.error('Failed to load team data:', error)
  }
}

// =====================================================
// Methods - Invitation Management
// =====================================================

const handleSendInvitation = async () => {
  if (!selectedOrganizationId.value) {
    $toast.error('No organization selected')
    return
  }

  if (!inviteForm.value.email || !inviteForm.value.email.includes('@')) {
    $toast.error('Please provide a valid email address')
    return
  }

  isInviting.value = true

  try {
    await sendInvitation(
      inviteForm.value.email,
      inviteForm.value.role,
      selectedOrganizationId.value
    )

    // Track invite
    track('team_member_invited', {
      role: inviteForm.value.role
    })

    // Reset form
    inviteForm.value.email = ''
    inviteForm.value.role = 'member'

    // Reload team data
    await loadTeamData(selectedOrganizationId.value)
  } catch (error) {
    // Error already handled in composable
  } finally {
    isInviting.value = false
  }
}

const handleCancelInvitation = (invitationId: string) => {
  pendingInvitationId.value = invitationId
  showCancelInvitationDialog.value = true
}

const confirmCancelInvitation = async () => {
  if (!selectedOrganizationId.value || !pendingInvitationId.value) return

  isCanceling.value = true

  try {
    await cancelInvitation(pendingInvitationId.value, selectedOrganizationId.value)
  } catch (error) {
    // Error already handled in composable
  } finally {
    isCanceling.value = false
    showCancelInvitationDialog.value = false
    pendingInvitationId.value = null
  }
}

const handleResendInvitation = async (invitationId: string) => {
  if (!selectedOrganizationId.value) return

  isResending.value = true

  try {
    await resendInvitation(invitationId, selectedOrganizationId.value)
  } catch (error) {
    // Error already handled in composable
  } finally {
    isResending.value = false
  }
}

// =====================================================
// Methods - Team Member Management
// =====================================================

const handleUpdateRole = async (payload: { memberId: string; newRole: string }) => {
  if (!selectedOrganizationId.value) return

  try {
    const member = teamMembers.value.find(m => m.id === payload.memberId)
    const previousRole = member?.role

    await updateMemberRole(
      payload.memberId,
      payload.newRole as 'admin' | 'member',
      selectedOrganizationId.value
    )

    track('member_role_changed', {
      new_role: payload.newRole,
      previous_role: previousRole
    })
  } catch (error) {
    // Error already handled in composable
  }
}

const handleRemoveMember = (payload: { memberId: string }) => {
  pendingMemberId.value = payload.memberId
  showRemoveMemberDialog.value = true
}

const confirmRemoveMember = async () => {
  if (!selectedOrganizationId.value || !pendingMemberId.value) return

  try {
    const member = teamMembers.value.find(m => m.id === pendingMemberId.value)
    const memberRole = member?.role

    await removeMember(pendingMemberId.value, selectedOrganizationId.value)

    track('member_removed', {
      role: memberRole
    })
  } catch (error) {
    // Error already handled in composable
  } finally {
    showRemoveMemberDialog.value = false
    pendingMemberId.value = null
  }
}

const handleManageAccess = (payload: { member: TeamMember }) => {
  selectedMember.value = payload.member
}

const handleSaveEnvironmentAccess = async (payload: {
  userId: string
  environmentIds: string[]
  accessLevels?: { environment_id: string; access_level: 'read' | 'write' }[]
}) => {
  if (!selectedOrganizationId.value) return

  try {
    await updateEnvironmentAccess(
      payload.userId,
      payload.environmentIds,
      selectedOrganizationId.value,
      payload.accessLevels
    )

    // Close modal
    selectedMember.value = null
  } catch (error) {
    // Error already handled in composable
  }
}

const isLastOwner = (member: TeamMember): boolean => {
  if (member.role !== 'owner') return false
  const ownerCount = teamMembers.value.filter(m => m.role === 'owner').length
  return ownerCount === 1
}

// =====================================================
// Utility Methods
// =====================================================

const formatExpiry = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (diffHours > 0) {
    return `in ${diffHours}h ${diffMinutes}m`
  } else if (diffMinutes > 0) {
    return `in ${diffMinutes}m`
  } else {
    return 'Expired'
  }
}

// =====================================================
// Lifecycle
// =====================================================

// Watch for organization changes
watch(selectedOrganizationId, async (orgId) => {
  if (!orgId) return
  await loadTeamData(orgId)
}, { immediate: true })
</script>
