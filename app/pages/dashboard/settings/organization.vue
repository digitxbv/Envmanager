<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <LoadingSpinner v-if="loading" class="py-12" />

    <!-- Access Denied (non-admin) -->
    <Card v-else-if="!isAdmin" class-name="text-center">
      <EmptyState
        icon="lucide:lock"
        title="Access Restricted"
        description="Only organization owners and admins can manage organization settings."
      />
    </Card>

    <template v-else>
      <!-- Organization Name -->
      <Card>
        <template #header>
          <h2 class="text-base font-semibold">Organization Name</h2>
        </template>
         <form @submit.prevent="handleSaveName" class="space-y-4">
           <div>
             <label class="block text-sm font-medium text-muted-foreground mb-2">Name</label>
            <Input
              v-model="orgName"
              type="text"
              placeholder="My Organization"
              :disabled="saving"
              required
            />
            <p class="mt-1.5 text-sm text-muted-foreground">
              This is the display name for your organization.
            </p>
          </div>
          <Button
            type="submit"
            :loading="saving"
            :disabled="!hasNameChanged || !orgName.trim()"
          >
            <Icon name="lucide:save" class="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </form>
      </Card>

      <!-- Danger Zone -->
      <Card class-name="border-destructive/30">
        <template #header>
          <h2 class="text-base font-semibold text-destructive">Danger Zone</h2>
        </template>
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-medium">Delete Organization</p>
            <p class="text-sm text-muted-foreground">
              Permanently delete this organization and all its projects, environments, and variables. This action cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            @click="showDeleteDialog = true"
          >
            <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </Card>
    </template>

    <!-- Delete Confirmation Dialog -->
    <ClientOnly>
      <Dialog
        :open="showDeleteDialog"
        title="Delete Organization"
        description="This action is permanent and cannot be undone. All projects, environments, variables, and team members will be removed."
        @close="closeDeleteDialog"
      >
         <div class="space-y-4">
           <div>
             <label class="block text-sm font-medium text-muted-foreground mb-2">
               Type <span class="font-mono font-bold">{{ currentOrg?.name }}</span> to confirm
             </label>
            <Input
              v-model="deleteConfirmText"
              type="text"
              :placeholder="currentOrg?.name || ''"
              :disabled="deleting"
            />
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="closeDeleteDialog" :disabled="deleting">
              Cancel
            </Button>
            <Button
              variant="destructive"
              :loading="deleting"
              :disabled="deleteConfirmText !== currentOrg?.name"
              @click="handleDeleteOrganization"
            >
              Delete Organization
            </Button>
          </div>
        </div>
      </Dialog>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Dialog from '@/components/ui/Dialog.vue'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

// =====================================================
// Core Composables
// =====================================================

const supabase = useSupabaseClient()
const { $toast } = useNuxtApp()
const organizationStore = useOrganizationStore()
const { getCurrentUserRole } = useTeamManagement()

// =====================================================
// Reactive State
// =====================================================

const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const orgName = ref('')
const originalName = ref('')
const currentUserRole = ref<'owner' | 'admin' | 'member' | 'viewer' | null>(null)
const showDeleteDialog = ref(false)
const deleteConfirmText = ref('')

// =====================================================
// Computed Properties
// =====================================================

const currentOrg = computed(() => organizationStore.selectedOrganization)
const selectedOrganizationId = computed(() => organizationStore.selectedOrganizationId)
const isAdmin = computed(() => currentUserRole.value === 'owner' || currentUserRole.value === 'admin')
const hasNameChanged = computed(() => orgName.value.trim() !== originalName.value)

// =====================================================
// Methods
// =====================================================

const loadRole = async () => {
  if (!selectedOrganizationId.value) return
  currentUserRole.value = await getCurrentUserRole(selectedOrganizationId.value)
}

const loadOrgData = () => {
  if (currentOrg.value) {
    orgName.value = currentOrg.value.name
    originalName.value = currentOrg.value.name
  }
}

const handleSaveName = async () => {
  if (!selectedOrganizationId.value || !orgName.value.trim()) return

  saving.value = true
  try {
    const { error } = await supabase
      .from('organizations')
      .update({ name: orgName.value.trim() })
      .eq('id', selectedOrganizationId.value)

    if (error) throw error

    // Update store
    const org = organizationStore.organizations.find(o => o.id === selectedOrganizationId.value)
    if (org) {
      org.name = orgName.value.trim()
    }
    originalName.value = orgName.value.trim()
    $toast.success('Organization name updated')
  } catch (err) {
    console.error('[organization] Failed to update name:', err)
    $toast.error(err instanceof Error ? err.message : 'Failed to update organization name')
  } finally {
    saving.value = false
  }
}

const handleDeleteOrganization = async () => {
  // Backend for org deletion doesn't exist yet
  $toast.error('Organization deletion is not yet available. Please contact support.')
  closeDeleteDialog()
}

const closeDeleteDialog = () => {
  showDeleteDialog.value = false
  deleteConfirmText.value = ''
}

// =====================================================
// Initialization
// =====================================================

onMounted(async () => {
  loading.value = true
  await loadRole()
  loadOrgData()
  loading.value = false
})

// React to org switch
watch(selectedOrganizationId, async () => {
  loading.value = true
  await loadRole()
  loadOrgData()
  loading.value = false
})
</script>
