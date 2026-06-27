<template>
  <div class="flex min-h-screen bg-background">
    <!-- Mobile overlay -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 z-40 bg-black/50 md:hidden"
        @click="isSidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar',
        'transition-transform duration-200 ease-out',
        'md:translate-x-0 md:static md:z-auto',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      ]"
    >
      <!-- Logo -->
      <div class="flex h-14 items-center gap-2.5 border-b border-border px-5">
        <NuxtLink to="/dashboard" class="flex items-center gap-2.5 transition-colors hover:text-primary" @click="isSidebarOpen = false">
          <Icon name="lucide:database" class="h-5 w-5 text-primary" />
          <span class="text-sm font-semibold text-sidebar-foreground">EnvManager</span>
        </NuxtLink>
      </div>

      <!-- Org Switcher -->
      <ClientOnly>
        <div v-if="organizations.length > 0 && !selfHosted" class="border-b border-border px-3 py-3">
           <div class="relative org-switcher">
             <button
               @click="isOrgMenuOpen = !isOrgMenuOpen"
               class="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground hover:bg-muted transition-all duration-150"
               :class="isOrgMenuOpen ? 'bg-muted' : ''"
             >
              <span class="flex items-center gap-2 truncate">
                <Icon name="lucide:building-2" class="h-4 w-4 shrink-0 text-muted-foreground" />
                <span class="truncate">{{ selectedOrganization?.name || 'Select Org' }}</span>
              </span>
              <Icon name="lucide:chevrons-up-down" class="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
            <div
              v-if="isOrgMenuOpen"
              class="absolute left-0 right-0 mt-1 rounded-md bg-popover shadow-lg ring-1 ring-border z-50"
            >
              <div class="py-1">
                <button
                  v-for="org in organizations"
                  :key="org.id"
                  @click="selectOrg(org.id)"
                  class="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors"
                  :class="org.id === selectedOrganizationId ? 'text-sidebar-foreground font-medium' : 'text-muted-foreground'"
                >
                  <span class="truncate">{{ org.name }}</span>
                  <Icon v-if="org.id === selectedOrganizationId" name="lucide:check" class="h-4 w-4 shrink-0 text-primary" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </ClientOnly>

      <!-- Scrollable nav area -->
      <nav class="flex-1 overflow-y-auto px-3 py-4">
        <!-- Main Navigation -->
        <div class="space-y-1">
          <NuxtLink
            to="/dashboard"
            class="sidebar-nav-item group"
            :class="route.path === '/dashboard' ? 'sidebar-nav-item--active' : ''"
            @click="isSidebarOpen = false"
          >
            <Icon name="lucide:layout-dashboard" class="h-4 w-4 shrink-0" />
            <span>Dashboard</span>
          </NuxtLink>
          <NuxtLink
            to="/dashboard/team"
            class="sidebar-nav-item group"
            :class="route.path.startsWith('/dashboard/team') ? 'sidebar-nav-item--active' : ''"
            @click="isSidebarOpen = false"
          >
            <Icon name="lucide:users" class="h-4 w-4 shrink-0" />
            <span>Team</span>
          </NuxtLink>
          <NuxtLink
            v-if="isOrgAdmin"
            to="/dashboard/activity"
            class="sidebar-nav-item group"
            :class="route.path.startsWith('/dashboard/activity') ? 'sidebar-nav-item--active' : ''"
            @click="isSidebarOpen = false"
          >
            <Icon name="lucide:activity" class="h-4 w-4 shrink-0" />
            <span>Activity</span>
          </NuxtLink>
        </div>

        <!-- Reviews Section (admin only) -->
        <div v-if="isOrgAdmin" class="mt-6">
          <p class="mb-2 px-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Reviews
          </p>
          <div class="space-y-1">
            <NuxtLink
              to="/dashboard/access-requests"
              class="sidebar-nav-item group"
              :class="route.path.startsWith('/dashboard/access-requests') ? 'sidebar-nav-item--active' : ''"
              @click="isSidebarOpen = false"
            >
              <Icon name="lucide:key-round" class="h-4 w-4 shrink-0" />
              <span class="flex-1">Access Requests</span>
              <span
                v-if="pendingAccessCount > 0"
                class="inline-flex items-center justify-center h-5 min-w-[1.25rem] rounded-full bg-warning px-1.5 text-[11px] font-bold text-warning-foreground"
              >
                {{ pendingAccessCount > 99 ? '99+' : pendingAccessCount }}
              </span>
            </NuxtLink>
            <NuxtLink
              to="/dashboard/pending-approvals"
              class="sidebar-nav-item group"
              :class="route.path.startsWith('/dashboard/pending-approvals') ? 'sidebar-nav-item--active' : ''"
              @click="isSidebarOpen = false"
            >
              <Icon name="lucide:check-circle" class="h-4 w-4 shrink-0" />
              <span class="flex-1">Pending Approvals</span>
              <span
                v-if="pendingApprovalsCount > 0"
                class="inline-flex items-center justify-center h-5 min-w-[1.25rem] rounded-full bg-warning px-1.5 text-[11px] font-bold text-warning-foreground"
              >
                {{ pendingApprovalsCount > 99 ? '99+' : pendingApprovalsCount }}
              </span>
            </NuxtLink>
          </div>
        </div>

        <!-- Platform Admin -->
        <div v-if="isPlatformAdmin" class="mt-6">
          <p class="mb-2 px-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Platform
          </p>
          <NuxtLink
            to="/admin"
            class="sidebar-nav-item group"
            :class="route.path.startsWith('/admin') ? 'sidebar-nav-item--active' : ''"
            @click="isSidebarOpen = false"
          >
            <Icon name="lucide:shield" class="h-4 w-4 shrink-0" />
            <span>Admin</span>
          </NuxtLink>
        </div>
      </nav>

      <!-- Bottom Section -->
      <div class="border-t border-border px-3 py-3 space-y-1">
        <!-- Settings -->
        <NuxtLink
          to="/dashboard/settings"
          class="sidebar-nav-item group"
          :class="route.path.startsWith('/dashboard/settings') ? 'sidebar-nav-item--active' : ''"
          @click="isSidebarOpen = false"
        >
          <Icon name="lucide:settings" class="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </NuxtLink>

        <!-- User section -->
         <div class="relative user-menu mt-2 pt-2 border-t border-border">
           <button
             @click="isUserMenuOpen = !isUserMenuOpen"
             class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground hover:bg-muted transition-all duration-150"
             :class="isUserMenuOpen ? 'bg-muted' : ''"
           >
            <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {{ userInitials }}
            </div>
            <span class="flex-1 truncate text-left text-sm text-sidebar-foreground">{{ user?.email }}</span>
            <Icon name="lucide:chevrons-up-down" class="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          <div
            v-if="isUserMenuOpen"
            class="absolute bottom-full left-0 right-0 mb-1 rounded-md bg-popover shadow-lg ring-1 ring-border z-50"
          >
            <div class="py-1">
              <button
                @click="signOut"
                class="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Icon name="lucide:log-out" class="h-4 w-4 text-muted-foreground" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex flex-1 flex-col min-w-0">
      <!-- Top Bar -->
      <header class="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-4 md:px-6">
        <!-- Mobile hamburger -->
        <button
          class="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          @click="isSidebarOpen = !isSidebarOpen"
        >
          <Icon name="lucide:menu" class="h-5 w-5" />
          <span class="sr-only">Toggle sidebar</span>
        </button>

        <!-- Breadcrumb area -->
        <div class="flex-1 min-w-0">
          <Breadcrumb :items="breadcrumbs" />
        </div>

        <ThemeToggle />

        <!-- Page-specific actions slot -->
        <div id="page-actions" class="flex items-center gap-2" />
      </header>

      <!-- Page content -->
      <main class="flex-1">
        <slot />
      </main>
    </div>

    <!-- Global Billing Limit Modal -->
    <BillingLimitReachedModal />

    <!-- Locked Workspace Overlay -->
    <BillingLockedOverlay v-if="isLocked && !isBillingRoute && !selfHosted" />
  </div>
</template>

<script setup lang="ts">
import BillingLimitReachedModal from '@/components/limits/LimitReachedModal.vue'
import BillingLockedOverlay from '@/components/limits/LockedOverlay.vue'

const BILLING_ALLOWLIST = [
  '/dashboard/settings/billing',
  '/dashboard/billing'
]

const user = useSupabaseUser()
const client = useSupabaseClient()
const colorMode = useColorMode()
const route = useRoute()
const { $toast } = useNuxtApp()

// Billing lock
const { isLocked, fetchSubscription } = useBilling()
const isBillingRoute = computed(() => BILLING_ALLOWLIST.some(path => route.path.startsWith(path)))
const selfHosted = computed(() => useRuntimeConfig().public.selfHosted as boolean)
const { group: posthogGroup, reset: posthogReset } = usePostHog()
const isUserMenuOpen = ref(false)
const isOrgMenuOpen = ref(false)
const isReviewsMenuOpen = ref(false)
const isSidebarOpen = ref(false)

// Breadcrumbs — child pages can inject via provide/inject
const breadcrumbs = ref<{ label: string; to?: string }[]>([])
provide('breadcrumbs', breadcrumbs)

// User initials for avatar
const userInitials = computed(() => {
  const email = user.value?.email
  if (!email) return '?'
  return email.substring(0, 2).toUpperCase()
})

// Close sidebar on route change (mobile)
watch(() => route.path, () => {
  isSidebarOpen.value = false
})

// Organization store
const orgStore = useOrganizationStore()
const selectedOrganizationId = computed(() => orgStore.selectedOrganizationId)
const selectedOrganization = computed(() => orgStore.selectedOrganization)
const organizations = computed(() => orgStore.organizations)

// Fetch subscription whenever the selected org changes (NOT on route change)
// so isLocked is reactive on every dashboard page, including hard loads
// where the middleware ran before the org store was populated.
watch(selectedOrganizationId, async (orgId, prevOrgId) => {
  if (!orgId || orgId === prevOrgId) return
  try {
    await fetchSubscription(orgId)
  } catch (error) {
    // Fail open — billing fetch errors must not break the dashboard
    console.warn('[dashboard layout] Failed to fetch subscription:', error)
  }
}, { immediate: true })

// Access requests badge (admin only)
const userOrgRole = ref<string | null>(null)
const isPlatformAdmin = ref(false)
const pendingAccessCount = ref(0)
const pendingApprovalsCount = ref(0)
let badgePollInterval: ReturnType<typeof setInterval> | null = null
let pendingApprovalsInterval: ReturnType<typeof setInterval> | null = null

const isOrgAdmin = computed(() =>
  userOrgRole.value === 'owner' || userOrgRole.value === 'admin'
)

const isOrgOwner = computed(() => userOrgRole.value === 'owner')

const totalReviewsCount = computed(() => pendingAccessCount.value + pendingApprovalsCount.value)

async function fetchPlatformAdminStatus() {
  const userId = user.value?.id ?? user.value?.sub

  if (!userId) {
    isPlatformAdmin.value = false
    return
  }

  const { data, error } = await client
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[dashboard layout] Failed to check platform admin status:', error)
    isPlatformAdmin.value = false
    return
  }

  isPlatformAdmin.value = !!data
}

// Fetch user role when org changes
watch(selectedOrganizationId, async (orgId) => {
  if (!orgId) {
    userOrgRole.value = null
    pendingAccessCount.value = 0
    pendingApprovalsCount.value = 0
    if (badgePollInterval) clearInterval(badgePollInterval)
    if (pendingApprovalsInterval) clearInterval(pendingApprovalsInterval)
    await fetchPlatformAdminStatus()
    return
  }

  const userId = user.value?.id ?? user.value?.sub
  if (!userId) {
    await fetchPlatformAdminStatus()
    return
  }

  // platform-admin status and the org role are independent — run in parallel
  // (one fewer transatlantic round-trip on every org switch), and cache the
  // role so the pages mounted below don't re-query it.
  const orgStore = useOrganizationStore()
  const [, roleRes] = await Promise.all([
    fetchPlatformAdminStatus(),
    client
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const role = (roleRes.data?.role ?? null) as 'owner' | 'admin' | 'member' | 'viewer' | null
  userOrgRole.value = role
  orgStore.setRole(orgId, role)

  // Start/stop polling based on role
  if (badgePollInterval) clearInterval(badgePollInterval)
  if (pendingApprovalsInterval) clearInterval(pendingApprovalsInterval)
  if (isOrgAdmin.value) {
    fetchPendingCount(orgId)
    fetchPendingApprovalsCount(orgId)
    badgePollInterval = setInterval(() => fetchPendingCount(orgId), 30000)
    pendingApprovalsInterval = setInterval(() => fetchPendingApprovalsCount(orgId), 30000)
  } else {
    pendingAccessCount.value = 0
    pendingApprovalsCount.value = 0
  }
}, { immediate: true })

watch(selectedOrganization, (org) => {
  if (org) {
    const billingStore = useBillingStore()
    posthogGroup('organization', org.id, {
      name: org.name,
      plan: billingStore.currentPlanId || 'free',
      created_at: org.created_at,
    })
  }
}, { immediate: true })

async function fetchPendingCount(orgId: string) {
  const { data } = await client.rpc('get_pending_access_requests_count', { p_org_id: orgId })
  if (typeof data === 'number') pendingAccessCount.value = data
}

async function fetchPendingApprovalsCount(orgId: string) {
  try {
    const { count, error } = await client
      .from('pending_changes')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'pending')

    if (error) throw error
    pendingApprovalsCount.value = count || 0
  } catch (error) {
    console.error('Failed to fetch pending approvals count:', error)
  }
}

onUnmounted(() => {
  if (badgePollInterval) clearInterval(badgePollInterval)
  if (pendingApprovalsInterval) clearInterval(pendingApprovalsInterval)
})

const selectOrg = (orgId: string) => {
  orgStore.selectOrganization(orgId)
  isOrgMenuOpen.value = false
}

const { logAuthEvent } = useAuthAudit()

const signOut = async () => {
  try {
    await logAuthEvent('logout', true)
    posthogReset()
    await client.auth.signOut()
    $toast.success('Signed out successfully')
    navigateTo('/')
  } catch (error) {
    $toast.error('Failed to sign out')
    console.error(error)
  }
}

// Load user's organizations
const loadOrganizations = async () => {
  // user.value contains JWT claims, where 'sub' is the user ID
  const userId = user.value?.sub

  if (!userId) return

  try {
    const { data: memberships, error } = await client
      .from('organization_members')
      .select('organization_id, organizations!inner(id, name, created_at)')
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to load organizations:', error)
      $toast.error('Failed to load organizations')
      return
    }

    if (memberships && memberships.length > 0) {
      const orgs = memberships
        .map(m => m.organizations)
        .filter(Boolean)

      orgStore.setOrganizations(orgs)
    }
  } catch (error) {
    console.error('Error loading organizations:', error)
    $toast.error('Failed to load organizations')
  }
}

// Watch for user to be loaded, then fetch organizations
watch(user, async (newUser) => {
  if (newUser?.sub && !organizations.value.length) {
    await loadOrganizations()
  }
}, { immediate: true })

onMounted(() => {
  // Close menus when clicking outside
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (isUserMenuOpen.value && !target.closest('.user-menu')) {
      isUserMenuOpen.value = false
    }
    if (isOrgMenuOpen.value && !target.closest('.org-switcher')) {
      isOrgMenuOpen.value = false
    }
    if (isReviewsMenuOpen.value && !target.closest('.reviews-dropdown')) {
      isReviewsMenuOpen.value = false
    }
  })

  // Load organizations after page:start hook populates user
  nextTick(async () => {
    if (!user.value) {
      // Wait up to 2 seconds for the user to be populated by the page:start hook
      let attempts = 0
      while (!user.value && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
    }

    if (user.value && !organizations.value.length) {
      await loadOrganizations()
    }
  })
})
</script>

<style scoped>
.sidebar-nav-item {
  @apply flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-all duration-150;
}
.sidebar-nav-item:hover {
  @apply bg-muted text-sidebar-foreground;
}
.sidebar-nav-item--active {
  @apply bg-muted text-sidebar-foreground font-semibold;
}
</style>
