<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <div class="space-y-6">
      <!-- Header -->
      <PageHeader title="Activity Log" description="Track all changes to variables and imports across your organization" />

      <!-- Access Restricted for Members -->
      <Card v-if="!canAccessActivityLog" class-name="text-center">
        <EmptyState
          icon="lucide:lock"
          title="Access Restricted"
          description="Only organization owners and admins can view the activity log."
        />
      </Card>

      <!-- Activity Log Content -->
      <template v-else>
        <!-- Filters -->
        <Card padding="sm">
          <div class="grid gap-4 md:grid-cols-5">
            <!-- Project Filter -->
            <div>
              <label class="block text-sm font-medium text-muted-foreground mb-2">Project</label>
              <Select
                :model-value="filters.projectId || ''"
                :options="projectOptions"
                placeholder="All Projects"
                @update:model-value="(val) => { filters.projectId = val || null; handleFilterChange() }"
              />
            </div>

            <!-- Environment Filter -->
            <div>
              <label class="block text-sm font-medium text-muted-foreground mb-2">Environment</label>
              <Select
                :model-value="filters.environmentId || ''"
                :options="environmentOptions"
                placeholder="All Environments"
                :disabled="!filters.projectId"
                @update:model-value="(val) => { filters.environmentId = val || null; handleFilterChange() }"
              />
            </div>

            <!-- Action Filter -->
            <div>
              <label class="block text-sm font-medium text-muted-foreground mb-2">Action</label>
              <Select
                :model-value="filters.action || ''"
                :options="actionOptions"
                placeholder="All Actions"
                @update:model-value="(val) => { filters.action = val || null; handleFilterChange() }"
              />
            </div>

            <!-- Date Range Quick Select -->
            <div>
              <label class="block text-sm font-medium text-muted-foreground mb-2">Date Range</label>
              <Select
                :model-value="dateRangePreset"
                :options="dateRangeOptions"
                placeholder="All Time"
                @update:model-value="(val) => { dateRangePreset = val; handleDatePresetChange() }"
              />
            </div>

            <!-- Clear Filters -->
            <div class="flex items-end">
              <button
                @click="clearFilters"
                class="flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Icon name="lucide:x" class="h-4 w-4 mr-1" />
                Clear
              </button>
            </div>
          </div>

          <!-- Custom Date Range -->
          <div v-if="dateRangePreset === 'custom'" class="grid gap-4 md:grid-cols-2 mt-4 pt-4 border-t border-border">
            <div>
              <label class="block text-sm font-medium text-muted-foreground mb-2">From</label>
              <Input
                type="date"
                v-model="customDateFrom"
                @change="handleCustomDateChange"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-muted-foreground mb-2">To</label>
              <Input
                type="date"
                v-model="customDateTo"
                @change="handleCustomDateChange"
              />
            </div>
          </div>
        </Card>

        <!-- Activity Table -->
        <Card padding="sm" class-name="!p-0 overflow-hidden">
          <DataTable
            :columns="tableColumns"
            :data="entries"
            :loading="loading"
            class="!border-0 !rounded-none [&_table]:min-w-[980px]"
          >
            <!-- Empty State -->
            <template #empty>
              <EmptyState
                icon="lucide:history"
                title="No Activity Found"
                :description="hasActiveFilters ? 'Try adjusting your filters to see more results.' : 'Activity will appear here when you create, update, delete, or import variables.'"
              />
            </template>

            <!-- Type Icon -->
            <template #cell-type="{ row }">
              <Icon
                :name="getTypeIcon(row.type)"
                class="h-5 w-5 text-muted-foreground"
                :title="getTypeTitle(row.type)"
              />
            </template>

            <!-- Action Badge -->
            <template #cell-action="{ row }">
              <Badge :variant="getActionBadgeVariant(row.action)">
                {{ row.action }}
              </Badge>
            </template>

            <!-- What -->
            <template #cell-what="{ row }">
              <span class="font-mono text-sm">
                {{ row.type === 'import' ? row.file_name : (row.variable_key || 'Unknown') }}
              </span>
            </template>

            <!-- Where (Project > Environment) -->
            <template #cell-where="{ row }">
              <span class="text-sm">
                <span class="text-foreground">{{ row.project_name }}</span>
                <span class="text-muted-foreground"> › </span>
                <span class="text-foreground">{{ row.environment_name }}</span>
              </span>
            </template>

            <!-- Who -->
            <template #cell-who="{ row }">
              <span class="text-sm text-muted-foreground">
                {{ row.user_email || 'Unknown' }}
              </span>
            </template>

            <!-- When -->
            <template #cell-when="{ row }">
              <span class="text-sm text-muted-foreground" :title="formatAbsoluteDate(row.created_at)">
                {{ formatRelativeTime(row.created_at) }}
              </span>
            </template>

            <!-- Details -->
            <template #cell-details="{ row }">
              <div>
                <button
                  v-if="hasDetails(row)"
                  @click="toggleDetails(row.id)"
                  class="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {{ expandedRows.has(row.id) ? 'Hide' : 'Show' }}
                </button>
                <span v-else class="text-sm text-muted-foreground">—</span>

                <!-- Expanded Details (inline below toggle) -->
                <div
                  v-if="expandedRows.has(row.id)"
                  class="mt-3 pt-3 border-t border-border"
                >
                  <div class="text-sm space-y-2">
                    <!-- Import Details -->
                    <template v-if="row.type === 'import'">
                      <div class="flex flex-wrap gap-4">
                        <div>
                          <span class="text-muted-foreground">Imported:</span>
                          <span class="ml-1.5 font-medium text-success">{{ row.variables_imported }}</span>
                        </div>
                        <div>
                          <span class="text-muted-foreground">Skipped:</span>
                          <span class="ml-1.5 font-medium text-warning">{{ row.variables_skipped }}</span>
                        </div>
                        <div>
                          <span class="text-muted-foreground">Overwritten:</span>
                          <span class="ml-1.5 font-medium text-primary">{{ row.variables_overwritten }}</span>
                        </div>
                      </div>
                    </template>

                    <!-- Variable Update Details -->
                    <template v-else-if="row.action === 'updated'">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-muted-foreground">Changed:</span>
                        <code class="px-2 py-0.5 rounded bg-muted text-destructive line-through">{{ truncateValue(row.old_value) }}</code>
                        <Icon name="lucide:arrow-right" class="h-4 w-4 text-muted-foreground" />
                        <code class="px-2 py-0.5 rounded bg-muted text-success">{{ truncateValue(row.new_value) }}</code>
                      </div>
                    </template>

                    <!-- Variable Created Details -->
                    <template v-else-if="row.action === 'created'">
                      <div class="flex items-center gap-2">
                        <span class="text-muted-foreground">Value:</span>
                        <code class="px-2 py-0.5 rounded bg-muted text-foreground">{{ truncateValue(row.new_value) }}</code>
                      </div>
                    </template>

                    <!-- Variable Deleted Details -->
                    <template v-else-if="row.action === 'deleted'">
                      <div class="flex items-center gap-2">
                        <span class="text-muted-foreground">Previous value:</span>
                        <code class="px-2 py-0.5 rounded bg-muted text-destructive">{{ truncateValue(row.old_value) }}</code>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </DataTable>

          <!-- Pagination -->
          <div v-if="entries.length > 0" class="p-4 border-t border-border">
            <Pagination
              :current-page="page"
              :total-items="totalCount"
              :page-size="pageSize"
              @update:page="handlePageChange"
            />
          </div>
        </Card>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import Pagination from '@/components/ui/Pagination.vue'
import Input from '@/components/ui/Input.vue'
import type { ActivityLogFilters, ActivityLogEntry } from '~/composables/useActivityLog'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

useHead({
  title: 'Activity Log - EnvManager',
  meta: [
    {
      name: 'description',
      content: 'Track all changes to variables and imports across your organization'
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
    { label: 'Activity' }
  ]
})

// =====================================================
// Composables
// =====================================================

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const organizationStore = useOrganizationStore()
const { getCurrentUserRole } = useTeamManagement()
const {
  entries,
  loading,
  totalCount,
  page,
  pageSize,
  fetchActivityLog,
  reset
} = useActivityLog()

// =====================================================
// State
// =====================================================

const currentUserRole = ref<'owner' | 'admin' | 'member' | 'viewer' | null>(null)
const projects = ref<Array<{ id: string; name: string }>>([])
const environments = ref<Array<{ id: string; name: string; project_id: string }>>([])
const expandedRows = ref(new Set<string>())

const filters = ref<ActivityLogFilters>({
  projectId: null,
  environmentId: null,
  action: null,
  dateFrom: null,
  dateTo: null
})

const dateRangePreset = ref<'all' | 'today' | '7days' | '30days' | 'custom'>('all')
const customDateFrom = ref('')
const customDateTo = ref('')

// =====================================================
// Computed
// =====================================================

const selectedOrganizationId = computed(() => organizationStore.selectedOrganizationId)

const canAccessActivityLog = computed(() =>
  currentUserRole.value === 'owner' || currentUserRole.value === 'admin'
)

const filteredEnvironments = computed(() => {
  if (!filters.value.projectId) return []
  return environments.value.filter(env => env.project_id === filters.value.projectId)
})

const hasActiveFilters = computed(() =>
  filters.value.projectId ||
  filters.value.environmentId ||
  filters.value.action ||
  filters.value.dateFrom ||
  filters.value.dateTo
)

// Select options
const projectOptions = computed(() => [
  { label: 'All Projects', value: '' },
  ...projects.value.map(p => ({ label: p.name, value: p.id }))
])

const environmentOptions = computed(() => [
  { label: 'All Environments', value: '' },
  ...filteredEnvironments.value.map(e => ({ label: e.name, value: e.id }))
])

const actionOptions = [
  { label: 'All Actions', value: '' },
  { label: 'Created', value: 'created' },
  { label: 'Updated', value: 'updated' },
  { label: 'Deleted', value: 'deleted' },
  { label: 'Imported', value: 'imported' },
  { label: 'Viewed', value: 'viewed' }
]

const dateRangeOptions = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7days' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'Custom', value: 'custom' }
]

// Table columns
const tableColumns = [
  { key: 'type', label: 'Type' },
  { key: 'action', label: 'Action' },
  { key: 'what', label: 'What' },
  { key: 'where', label: 'Where' },
  { key: 'who', label: 'Who' },
  { key: 'when', label: 'When' },
  { key: 'details', label: 'Details' }
]

// =====================================================
// Methods
// =====================================================

const loadInitialData = async (orgId: string) => {
  const userId = user.value?.id ?? user.value?.sub
  if (!userId) return

  // Role gates access — must resolve before deciding to load anything.
  const role = await getCurrentUserRole(orgId)
  currentUserRole.value = role

  if (role !== 'owner' && role !== 'admin') {
    return
  }

  // projects, environments and the activity log are independent (all keyed off
  // orgId only). Run them in parallel instead of a sequential waterfall — over a
  // transatlantic link that turns 3 round-trips into 1.
  const [projectsRes, envsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name')
      .eq('organization_id', orgId)
      .order('name'),
    supabase
      .from('environments')
      .select('id, name, project_id')
      .eq('organization_id', orgId)
      .order('name'),
    fetchActivityLog(orgId, filters.value, 1),
  ])

  projects.value = projectsRes.data || []
  environments.value = envsRes.data || []
}

const handleFilterChange = () => {
  // Reset environment filter if project changes
  if (!filters.value.projectId) {
    filters.value.environmentId = null
  }

  // Reset to page 1 and fetch
  if (selectedOrganizationId.value && canAccessActivityLog.value) {
    fetchActivityLog(selectedOrganizationId.value, filters.value, 1)
  }
}

const handleDatePresetChange = () => {
  const now = new Date()

  switch (dateRangePreset.value) {
    case 'today':
      filters.value.dateFrom = new Date(now.setHours(0, 0, 0, 0)).toISOString()
      filters.value.dateTo = null
      break
    case '7days': {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      filters.value.dateFrom = sevenDaysAgo.toISOString()
      filters.value.dateTo = null
      break
    }
    case '30days': {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      filters.value.dateFrom = thirtyDaysAgo.toISOString()
      filters.value.dateTo = null
      break
    }
    case 'custom':
      // Don't change filters, wait for custom date inputs
      return
    default:
      filters.value.dateFrom = null
      filters.value.dateTo = null
  }

  handleFilterChange()
}

const handleCustomDateChange = () => {
  if (customDateFrom.value) {
    filters.value.dateFrom = new Date(customDateFrom.value).toISOString()
  } else {
    filters.value.dateFrom = null
  }

  if (customDateTo.value) {
    // Set to end of day
    const endDate = new Date(customDateTo.value)
    endDate.setHours(23, 59, 59, 999)
    filters.value.dateTo = endDate.toISOString()
  } else {
    filters.value.dateTo = null
  }

  handleFilterChange()
}

const clearFilters = () => {
  filters.value = {
    projectId: null,
    environmentId: null,
    action: null,
    dateFrom: null,
    dateTo: null
  }
  dateRangePreset.value = 'all'
  customDateFrom.value = ''
  customDateTo.value = ''
  handleFilterChange()
}

const handlePageChange = (newPage: number) => {
  if (selectedOrganizationId.value && canAccessActivityLog.value) {
    fetchActivityLog(selectedOrganizationId.value, filters.value, newPage)
  }
}

const getActionBadgeVariant = (action: string): string => {
  switch (action) {
    case 'created':
      return 'success'
    case 'updated':
      return 'default'
    case 'deleted':
      return 'destructive'
    case 'imported':
      return 'outline'
    case 'viewed':
      return 'warning'
    default:
      return 'default'
  }
}

const getTypeIcon = (type: string): string => {
  switch (type) {
    case 'import':
      return 'lucide:file-up'
    case 'secret_view':
      return 'lucide:eye'
    default:
      return 'lucide:variable'
  }
}

const getTypeTitle = (type: string): string => {
  switch (type) {
    case 'import':
      return 'Import'
    case 'secret_view':
      return 'Secret View'
    default:
      return 'Variable'
  }
}

const hasDetails = (entry: ActivityLogEntry): boolean => {
  if (entry.type === 'import') return true
  if (entry.action === 'updated' && (entry.old_value || entry.new_value)) return true
  if (entry.action === 'created' && entry.new_value) return true
  if (entry.action === 'deleted' && entry.old_value) return true
  return false
}

const toggleDetails = (id: string) => {
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id)
  } else {
    expandedRows.value.add(id)
  }
}

const truncateValue = (value: string | null | undefined): string => {
  if (!value) return '(empty)'
  // Mask vault references (secrets) - they look like "vault:{uuid}"
  if (value.startsWith('vault:')) return '••••••••'
  if (value.length > 50) return value.substring(0, 50) + '...'
  return value
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const formatAbsoluteDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString()
}

// =====================================================
// Lifecycle
// =====================================================

watch(
  [selectedOrganizationId, user],
  async ([orgId, currentUser]) => {
    const userId = currentUser?.id ?? currentUser?.sub
    if (!orgId || !userId) {
      reset()
      return
    }
    await loadInitialData(orgId)
  },
  { immediate: true }
)
</script>
