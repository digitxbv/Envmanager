<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-semibold">Organizations</h1>
        <p class="text-sm text-muted-foreground mt-1">
          View and manage all organizations and subscriptions
        </p>
      </div>

      <Card padding="sm">
        <label class="mb-2 block text-sm font-medium">Search</label>
        <Input
          v-model="searchTerm"
          placeholder="Search by organization name or owner email"
        />
      </Card>

      <Card v-if="error" class-name="!border-destructive/20 !bg-destructive/5">
        <p class="text-sm text-destructive">{{ error }}</p>
      </Card>

      <Card v-else padding="sm" class="!p-0 overflow-hidden">
        <DataTable
          :columns="orgColumns"
          :data="filteredOrganizations"
          :loading="loading"
          empty-message="No organizations found."
          class="!border-0 !rounded-none [&_table]:min-w-[900px]"
        >
          <template #empty>
            <EmptyState
              icon="lucide:building-2"
              title="No organizations found"
              :description="searchTerm ? 'Try adjusting your search term' : 'No organizations exist yet'"
            />
          </template>
          <template #cell-name="{ row }">
            <button
              class="font-medium text-foreground hover:text-primary transition-colors text-left"
              @click="openOrganization(row.id)"
            >
              {{ row.name }}
            </button>
          </template>
          <template #cell-owner_email="{ row }">
            <span class="text-muted-foreground">{{ row.owner_email || 'Unknown' }}</span>
          </template>
          <template #cell-plan="{ row }">
            {{ formatPlanName(row.subscription?.plan_id) }}
          </template>
          <template #cell-status="{ row }">
            <Badge :variant="getStatusVariant(row.subscription?.status)">
              {{ row.subscription?.status || 'none' }}
            </Badge>
          </template>
          <template #cell-member_count="{ value }">
            {{ value }}
          </template>
          <template #cell-env_var_count="{ value }">
            <span :class="{ 'text-muted-foreground': (value as number) === 0 }">{{ value }}</span>
          </template>
          <template #cell-created_at="{ value }">
            <span class="text-muted-foreground">{{ formatDate(value as string) }}</span>
          </template>
          <template #cell-last_sign_in_at="{ value }">
            <span v-if="value" class="text-muted-foreground">{{ formatDate(value as string) }}</span>
            <span v-else class="text-muted-foreground italic">Never</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex items-center justify-end gap-3">
              <button
                class="text-sm text-primary hover:text-primary/80 transition-colors"
                @click="openOrganization(row.id)"
              >
                Open
              </button>
              <button
                class="text-muted-foreground hover:text-destructive transition-colors"
                title="Delete organization"
                @click="openDeleteDialog(row)"
              >
                <Icon name="lucide:trash-2" class="h-4 w-4" />
                <span class="sr-only">Delete {{ row.name }}</span>
              </button>
            </div>
          </template>
        </DataTable>
      </Card>

      <DeleteOrganizationDialog
        :open="deleteDialogOpen"
        :organization="orgToDelete"
        @close="deleteDialogOpen = false"
        @deleted="handleOrganizationDeleted"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from '@/components/ui/Input.vue'
import type { PlatformOrganizationSummary } from '~/composables/usePlatformAdmin'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'platform-admin']
})

const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

const { fetchOrganizations } = usePlatformAdmin()

const loading = ref(true)
const error = ref<string | null>(null)
const searchTerm = ref('')
const organizations = ref<PlatformOrganizationSummary[]>([])

const deleteDialogOpen = ref(false)
const orgToDelete = ref<{ id: string; name: string } | null>(null)

const openDeleteDialog = (org: PlatformOrganizationSummary) => {
  orgToDelete.value = { id: org.id, name: org.name }
  deleteDialogOpen.value = true
}

const handleOrganizationDeleted = (org: { id: string; name: string }) => {
  organizations.value = organizations.value.filter((o) => o.id !== org.id)
}

const orgColumns = [
  { key: 'name', label: 'Organization' },
  { key: 'owner_email', label: 'Owner' },
  { key: 'plan', label: 'Plan' },
  { key: 'status', label: 'Status' },
  { key: 'member_count', label: 'Members' },
  { key: 'integration_count', label: 'Integrations' },
  { key: 'env_var_count', label: 'Env Vars' },
  { key: 'created_at', label: 'Created' },
  { key: 'last_sign_in_at', label: 'Last Sign-In' },
  { key: 'actions', label: '' }
]

const filteredOrganizations = computed(() => {
  const search = searchTerm.value.trim().toLowerCase()

  if (!search) return organizations.value

  return organizations.value.filter((org) => {
    const nameMatch = org.name.toLowerCase().includes(search)
    const ownerMatch = (org.owner_email || '').toLowerCase().includes(search)
    return nameMatch || ownerMatch
  })
})

const formatPlanName = (planId?: string): string => {
  if (!planId) return 'N/A'
  if (planId === 'pro_monthly') return 'Pro Monthly'
  if (planId === 'pro_annual') return 'Pro Annual'
  if (planId === 'free') return 'Free'
  return planId
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getStatusVariant = (status?: string): string => {
  if (status === 'active') return 'success'
  if (status === 'trialing') return 'default'
  if (status === 'canceled') return 'destructive'
  return 'outline'
}

const openOrganization = (organizationId: string) => {
  navigateTo(`/admin/organizations/${organizationId}`)
}

const loadOrganizations = async () => {
  loading.value = true
  error.value = null

  try {
    organizations.value = await fetchOrganizations()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load organizations'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  breadcrumbs.value = [
    { label: 'Admin', to: '/admin' },
    { label: 'Organizations' }
  ]
  loadOrganizations()
})
</script>
