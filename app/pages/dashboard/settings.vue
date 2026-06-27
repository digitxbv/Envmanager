<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <div class="flex flex-col gap-4 md:flex-row md:gap-8">
      <!-- Settings Sidebar -->
      <nav class="w-56 shrink-0 hidden md:block">
        <div class="sticky top-6 space-y-1">
          <template v-for="section in visibleSections" :key="section.id">
            <NuxtLink
              :to="`/dashboard/settings/${section.id}`"
              :class="[
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActiveSection(section.id)
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                section.disabled && 'opacity-50 pointer-events-none'
              ]"
            >
              <Icon :name="section.icon || 'lucide:circle'" class="h-4 w-4 shrink-0" />
              {{ section.label }}
            </NuxtLink>
          </template>
        </div>
      </nav>

      <!-- Mobile Section Selector -->
      <div class="w-full md:hidden">
        <Select
          :model-value="currentSectionId"
          :options="visibleSections.filter(s => !s.disabled).map(s => ({ label: s.label, value: s.id }))"
          @update:model-value="navigateTo(`/dashboard/settings/${$event}`)"
        />
      </div>

      <!-- Content Area -->
      <div class="flex-1 min-w-0 space-y-6">
        <PageHeader
          title="Settings"
          description="Manage your account, organization, and security settings"
        />
        <NuxtPage />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Select from '@/components/ui/Select.vue'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

useHead({
  title: 'Settings - EnvManager',
  meta: [
    {
      name: 'description',
      content: 'Manage your account, organization, and security settings'
    }
  ]
})

// =====================================================
// Route & Navigation
// =====================================================

const route = useRoute()
const router = useRouter()

// Redirect old ?tab=X URLs to new sub-routes
if (route.query.tab && typeof route.query.tab === 'string') {
  const tabId = route.query.tab as SettingsTabId
  const validTabs = ['account', 'organization', 'integrations', 'security', 'naming', 'billing', 'notifications', 'api-keys']
  
  if (validTabs.includes(tabId)) {
    navigateTo(`/dashboard/settings/${tabId}`, { redirectCode: 301, replace: true })
  }
}

// =====================================================
// Core Composables
// =====================================================

const user = useSupabaseUser()
const organizationStore = useOrganizationStore()
const { getCurrentUserRole } = useTeamManagement()

// =====================================================
// Reactive State
// =====================================================

type SettingsTabId = 'account' | 'organization' | 'integrations' | 'security' | 'naming' | 'billing' | 'notifications' | 'api-keys'
type SettingsSection = {
  id: SettingsTabId
  label: string
  icon: string
  disabled: boolean
  hidden: boolean
}

const currentUserRole = ref<'owner' | 'admin' | 'member' | 'viewer' | null>(null)

// =====================================================
// Computed Properties
// =====================================================

const selectedOrganizationId = computed(() => organizationStore.selectedOrganizationId)

const currentSectionId = computed(() => {
  const path = route.path
  const match = path.match(/\/dashboard\/settings\/([^/]+)/)
  return match?.[1] || 'account'
})

const selfHosted = computed(() => useRuntimeConfig().public.selfHosted as boolean)

const sections = computed<SettingsSection[]>(() => {
  const isAdmin = currentUserRole.value === 'owner' || currentUserRole.value === 'admin'
  return [
    { id: 'account', label: 'Account', icon: 'lucide:user', disabled: false, hidden: false },
    { id: 'organization', label: 'Organization', icon: 'lucide:users', disabled: false, hidden: !isAdmin },
    { id: 'integrations', label: 'Integrations', icon: 'lucide:plug', disabled: false, hidden: !isAdmin },
    { id: 'security', label: 'Security', icon: 'lucide:shield', disabled: false, hidden: false },
    { id: 'naming', label: 'Naming', icon: 'lucide:case-sensitive', disabled: false, hidden: !isAdmin },
    { id: 'billing', label: 'Billing', icon: 'lucide:credit-card', disabled: false, hidden: selfHosted.value },
    { id: 'notifications', label: 'Notifications', icon: 'lucide:bell', disabled: true, hidden: false },
    { id: 'api-keys', label: 'API Keys', icon: 'lucide:key', disabled: true, hidden: false }
  ]
})

const visibleSections = computed(() => sections.value.filter(s => !s.hidden))

// =====================================================
// Methods
// =====================================================

const isActiveSection = (sectionId: SettingsTabId): boolean => {
  return currentSectionId.value === sectionId
}

const loadUserRole = async (orgId: string) => {
  const userId = user.value?.id ?? user.value?.sub
  if (!orgId || !userId) return

  try {
    const role = await getCurrentUserRole(orgId)
    currentUserRole.value = role || 'member'
  } catch (error) {
    console.error('Failed to load user role:', error)
  }
}

// =====================================================
// Lifecycle
// =====================================================

watch(
  [selectedOrganizationId, user],
  async ([orgId, currentUser]) => {
    const userId = currentUser?.id ?? currentUser?.sub
    if (!orgId || !userId) return
    await loadUserRole(orgId)
  },
  { immediate: true }
)

// Redirect non-admins away from restricted tabs
watch(currentUserRole, (role) => {
  const isAdmin = role === 'owner' || role === 'admin'
  const restrictedTabs = ['organization', 'integrations', 'naming']
  
  if (!isAdmin && restrictedTabs.includes(currentSectionId.value)) {
    navigateTo('/dashboard/settings/account', { replace: true })
  }
})
</script>
