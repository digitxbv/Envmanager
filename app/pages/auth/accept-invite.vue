<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-4">
    <div class="w-full max-w-md">
      <!-- Loading State -->
      <div v-if="state === 'loading'" class="bg-card border rounded-lg p-8 text-center">
        <Icon name="lucide:loader-2" class="animate-spin h-12 w-12 mx-auto mb-4 text-primary" />
        <h2 class="text-xl font-semibold mb-2">Processing Invitation</h2>
        <p class="text-muted-foreground">Please wait while we process your invitation...</p>
      </div>

      <!-- Success State -->
      <div v-else-if="state === 'success'" class="bg-card border rounded-lg p-8 text-center">
        <div class="mb-4">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
            <Icon name="lucide:check-circle" class="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <h2 class="text-2xl font-bold mb-2">Welcome to {{ organizationName }}!</h2>
        <p class="text-muted-foreground mb-6">
          You've successfully joined the organization as a {{ role }}.
        </p>
        <Button @click="goToDashboard" class="w-full">
          <Icon name="lucide:arrow-right" class="mr-2 h-4 w-4" />
          Go to Dashboard
        </Button>
      </div>

      <!-- Error State -->
      <div v-else-if="state === 'error'" class="bg-card border rounded-lg p-8 text-center">
        <div class="mb-4">
          <div class="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
            <Icon name="lucide:x-circle" class="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <h2 class="text-2xl font-bold mb-2">{{ errorTitle }}</h2>
        <p class="text-muted-foreground mb-6">{{ errorMessage }}</p>

        <div class="space-y-3">
          <Button v-if="showRegisterButton" @click="goToRegister" variant="default" class="w-full">
            <Icon name="lucide:user-plus" class="mr-2 h-4 w-4" />
            Create Account
          </Button>
          <Button v-if="showLoginButton" @click="goToLogin" variant="default" class="w-full">
            <Icon name="lucide:log-in" class="mr-2 h-4 w-4" />
            Sign In
          </Button>
          <Button @click="goToHome" variant="outline" class="w-full">
            <Icon name="lucide:home" class="mr-2 h-4 w-4" />
            Go to Home
          </Button>
        </div>
      </div>

      <!-- Redirecting State -->
      <div v-else-if="state === 'redirecting'" class="bg-card border rounded-lg p-8 text-center">
        <Icon name="lucide:loader-2" class="animate-spin h-12 w-12 mx-auto mb-4 text-primary" />
        <h2 class="text-xl font-semibold mb-2">Account Required</h2>
        <p class="text-muted-foreground">Redirecting you to create an account...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

definePageMeta({
  layout: false
})

useHead({
  title: 'Accept Invitation - EnvManager',
  meta: [
    {
      name: 'description',
      content: 'Accept your invitation to join an organization'
    }
  ]
})

// =====================================================
// Core Composables
// =====================================================

const route = useRoute()
const router = useRouter()
const client = useSupabaseClient()
const user = useSupabaseUser()
const organizationStore = useOrganizationStore()
const { track } = usePostHog()

// =====================================================
// Reactive State
// =====================================================

type PageState = 'loading' | 'success' | 'error' | 'redirecting'

const state = ref<PageState>('loading')
const errorTitle = ref('')
const errorMessage = ref('')
const organizationName = ref('')
const role = ref('')
const showRegisterButton = ref(false)
const showLoginButton = ref(false)

// =====================================================
// Methods
// =====================================================

const acceptInvitation = async (token: string) => {
  try {
    const { data, error } = await client.rpc('accept_invitation', {
      p_token: token
    })

    if (error) {
      handleAcceptError(error)
      return
    }

    // Successful acceptance
    const result = data as { success: boolean; organization_id: string; organization_name: string; role: string }

    organizationName.value = result.organization_name
    role.value = result.role === 'admin' ? 'Administrator' : 'Member'

    // Refresh organizations in store
    const { data: orgs } = await client
      .from('organizations')
      .select('*')
      .in('id', [result.organization_id])

    if (orgs && orgs.length > 0) {
      organizationStore.setOrganizations(orgs)
    }

    track('invitation_accepted', {
      organization_id: result.organization_id,
      role: result.role
    })

    state.value = 'success'
  } catch (err) {
    console.error('Failed to accept invitation:', err)
    errorTitle.value = 'Something Went Wrong'
    errorMessage.value = 'An unexpected error occurred. Please try again later.'
    state.value = 'error'
  }
}

const handleAcceptError = (error: any) => {
  const errorMsg = error.message || ''

  if (errorMsg.includes('expired')) {
    errorTitle.value = 'Invitation Expired'
    errorMessage.value = 'This invitation has expired. Please contact the organization owner for a new invitation.'
  } else if (errorMsg.includes('not found')) {
    errorTitle.value = 'Invalid Invitation'
    errorMessage.value = 'This invitation link is invalid or has been canceled.'
  } else if (errorMsg.includes('already been accepted')) {
    errorTitle.value = 'Already Accepted'
    errorMessage.value = 'You have already accepted this invitation. Please sign in to access your organization.'
    showLoginButton.value = true
  } else if (errorMsg.includes('canceled')) {
    errorTitle.value = 'Invitation Canceled'
    errorMessage.value = 'This invitation has been canceled by the organization owner.'
  } else if (errorMsg.includes('already a member')) {
    errorTitle.value = 'Already a Member'
    errorMessage.value = 'You are already a member of this organization. Please sign in to access it.'
    showLoginButton.value = true
  } else if (errorMsg.includes('different email')) {
    errorTitle.value = 'Email Mismatch'
    errorMessage.value = 'This invitation is for a different email address. Please sign in with the correct account or create a new account with the invited email.'
    showLoginButton.value = true
    showRegisterButton.value = true
  } else {
    errorTitle.value = 'Could Not Accept Invitation'
    errorMessage.value = errorMsg || 'An error occurred while accepting the invitation. Please try again.'
  }

  state.value = 'error'
}

const goToDashboard = () => {
  router.push('/dashboard')
}

const goToRegister = () => {
  router.push({
    path: '/auth/register',
    query: { redirect: route.fullPath }
  })
}

const goToLogin = () => {
  router.push('/auth/login')
}

const goToHome = () => {
  router.push('/')
}

// =====================================================
// Lifecycle
// =====================================================

onMounted(async () => {
  // Get token from URL
  const token = route.query.token as string

  if (!token) {
    errorTitle.value = 'Missing Invitation Token'
    errorMessage.value = 'The invitation link is invalid. Please check the link and try again.'
    state.value = 'error'
    return
  }

  // Check if user is logged in
  if (!user.value) {
    // Not logged in - redirect to register with return URL (no sessionStorage)
    state.value = 'redirecting'

    // Wait a moment for user to see the message
    await new Promise(resolve => setTimeout(resolve, 1500))

    await router.push({
      path: '/auth/register',
      query: { redirect: route.fullPath }
    })
    return
  }

  // User is logged in - accept invitation
  await acceptInvitation(token)
})
</script>
