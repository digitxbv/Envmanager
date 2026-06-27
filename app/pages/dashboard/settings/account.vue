<template>
  <!-- Account Information -->
  <Card>
    <template #header>
      <h2 class="text-base font-semibold">Account Information</h2>
    </template>
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-muted-foreground mb-1">
          Email Address
        </label>
        <p class="text-base text-foreground">{{ user?.email || 'Not available' }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium text-muted-foreground mb-1">
          Member Since
        </label>
        <p class="text-base text-foreground">{{ formatDate(memberSince) }}</p>
      </div>
    </div>
  </Card>

  <!-- Change Password -->
  <Card>
    <template #header>
      <h2 class="text-base font-semibold">Change Password</h2>
    </template>
    <form @submit.prevent="handleChangePassword" class="space-y-4">
       <div>
         <label class="block text-sm font-medium text-muted-foreground mb-2">
           New Password
         </label>
        <Input
          v-model="passwordForm.newPassword"
          type="password"
          placeholder="Enter new password"
          :disabled="passwordLoading"
          required
        />
      </div>
       <div>
         <label class="block text-sm font-medium text-muted-foreground mb-2">
           Confirm New Password
         </label>
        <Input
          v-model="passwordForm.confirmPassword"
          type="password"
          placeholder="Confirm new password"
          :disabled="passwordLoading"
          required
        />
      </div>
      <div v-if="passwordError" class="text-sm text-destructive">
        {{ passwordError }}
      </div>
      <Button
        type="submit"
        :loading="passwordLoading"
        :disabled="!isPasswordFormValid"
      >
        <Icon name="lucide:lock" class="mr-2 h-4 w-4" />
        Update Password
      </Button>
    </form>
  </Card>

  <!-- Data Export -->
  <Card>
    <template #header>
      <h2 class="text-base font-semibold">Export Your Data</h2>
    </template>
    <div class="space-y-3">
      <p class="text-sm text-muted-foreground">
        Download a copy of all your personal data in JSON format.
      </p>
      <Button variant="outline" :loading="exportLoading" @click="handleExportData">
        <Icon name="lucide:download" class="mr-2 h-4 w-4" />
        Download My Data
      </Button>
    </div>
  </Card>

  <!-- Delete Account -->
  <Card class="border-destructive/50">
    <template #header>
      <h2 class="text-base font-semibold text-destructive">Danger Zone</h2>
    </template>
    <div class="space-y-3">
      <p class="text-sm text-muted-foreground">
        Permanently delete your account and all associated data. This action cannot be undone.
      </p>
      <Button variant="destructive" @click="showDeleteAccountDialog = true">
        <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
        Delete Account
      </Button>
    </div>
  </Card>

  <!-- Delete Account Confirmation Dialog -->
  <Teleport to="body">
    <div v-if="showDeleteAccountDialog" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="showDeleteAccountDialog = false" />
      <div class="relative bg-card rounded-lg border shadow-lg p-6 w-full max-w-md mx-4 space-y-4">
        <h3 class="text-lg font-semibold text-destructive">Delete Account</h3>
        <p class="text-sm text-muted-foreground">
          This will permanently delete your account, all projects, variables, and data. This action cannot be undone.
        </p>
        <div class="space-y-2">
          <label class="text-sm font-medium">Type <span class="font-mono font-bold">DELETE</span> to confirm:</label>
          <Input v-model="deleteConfirmText" placeholder="DELETE" />
        </div>
        <div v-if="deleteAccountError" class="text-sm text-destructive">
          {{ deleteAccountError }}
        </div>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showDeleteAccountDialog = false; deleteConfirmText = ''; deleteAccountError = ''">
            Cancel
          </Button>
          <Button
            variant="destructive"
            :loading="deleteAccountLoading"
            :disabled="deleteConfirmText !== 'DELETE'"
            @click="handleDeleteAccount"
          >
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

// =====================================================
// Core Composables
// =====================================================

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { $toast } = useNuxtApp()
const { logAuthEvent } = useAuthAudit()
const organizationStore = useOrganizationStore()
const {
  members: teamMembers,
  fetchMembers
} = useTeamManagement()

// =====================================================
// Reactive State
// =====================================================

const passwordLoading = ref(false)
const passwordError = ref('')
const exportLoading = ref(false)
const deleteAccountLoading = ref(false)
const deleteAccountError = ref('')
const showDeleteAccountDialog = ref(false)
const deleteConfirmText = ref('')

const passwordForm = ref({
  newPassword: '',
  confirmPassword: ''
})

// =====================================================
// Computed Properties
// =====================================================

const selectedOrganizationId = computed(() => organizationStore.selectedOrganizationId)

const isPasswordFormValid = computed(() => {
  return (
    passwordForm.value.newPassword.length >= 12 &&
    passwordForm.value.confirmPassword.length >= 12 &&
    passwordForm.value.newPassword === passwordForm.value.confirmPassword
  )
})

const memberSince = computed(() => {
  const userId = user.value?.id ?? user.value?.sub
  const member = teamMembers.value.find(m => m.user_id === userId)
  return member?.created_at || ''
})

// =====================================================
// Methods
// =====================================================

const formatDate = (dateString: string): string => {
  if (!dateString) return 'Unknown'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const handleChangePassword = async () => {
  passwordError.value = ''

  // Validate passwords match
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordError.value = 'Passwords do not match'
    return
  }

  // Validate minimum length
  if (passwordForm.value.newPassword.length < 12) {
    passwordError.value = 'Password must be at least 12 characters'
    return
  }

  passwordLoading.value = true

  try {
    const { error } = await supabase.auth.updateUser({
      password: passwordForm.value.newPassword
    })

    if (error) throw error

    logAuthEvent('password_change', true)
    $toast.success('Password updated successfully')

    // Reset form
    passwordForm.value.newPassword = ''
    passwordForm.value.confirmPassword = ''
  } catch (error: any) {
    console.error('Failed to update password:', error)
    passwordError.value = error.message || 'Failed to update password'
    $toast.error('Failed to update password')
  } finally {
    passwordLoading.value = false
  }
}

// =====================================================
// Data Export & Account Deletion
// =====================================================

const handleExportData = async () => {
  exportLoading.value = true
  try {
    const { data, error } = await supabase.rpc('export_user_data')
    if (error) throw error

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `envmanager-data-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    $toast.success('Data exported successfully')
  } catch (error: any) {
    console.error('Failed to export data:', error)
    $toast.error('Failed to export data')
  } finally {
    exportLoading.value = false
  }
}

const handleDeleteAccount = async () => {
  if (deleteConfirmText.value !== 'DELETE') return

  deleteAccountLoading.value = true
  deleteAccountError.value = ''

  try {
    const { data, error } = await supabase.rpc('delete_user_account')
    if (error) throw error

    const result = data as { success: boolean; error?: string } | null
    if (!result?.success) {
      deleteAccountError.value = result?.error || 'Failed to delete account'
      return
    }

    await supabase.auth.signOut()
    $toast.success('Account deleted successfully')
    navigateTo('/auth/login')
  } catch (error: any) {
    console.error('Failed to delete account:', error)
    deleteAccountError.value = error.message || 'Failed to delete account'
  } finally {
    deleteAccountLoading.value = false
  }
}

// =====================================================
// Lifecycle - Load team members for memberSince
// =====================================================

watch(
  [selectedOrganizationId, user],
  async ([orgId, currentUser]) => {
    const userId = currentUser?.id ?? currentUser?.sub
    if (!orgId || !userId) return
    await fetchMembers(orgId)
  },
  { immediate: true }
)
</script>
