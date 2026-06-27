<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-semibold">{{ detail?.organization.name || 'Organization' }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          Review members, billing events, and subscription settings
        </p>
      </div>

      <div v-if="loading" class="flex justify-center py-16">
        <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-primary" />
      </div>

      <Card v-else-if="error" class-name="!border-destructive/20 !bg-destructive/5">
        <p class="text-sm text-destructive">{{ error }}</p>
      </Card>

      <template v-else-if="detail">
        <!-- Statistics -->
        <div class="grid gap-4 md:grid-cols-3">
          <Card v-for="stat in detailStats" :key="stat.label">
            <p class="text-sm text-muted-foreground">{{ stat.label }}</p>
            <p class="mt-2 text-2xl font-semibold">{{ stat.value }}</p>
          </Card>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <!-- Organization Info -->
          <Card>
            <template #header>
              <h2 class="text-base font-semibold">Organization</h2>
            </template>
            <dl class="space-y-3 text-sm">
              <div class="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <dt class="text-muted-foreground">Name</dt>
                <dd class="font-medium">{{ detail.organization.name }}</dd>
              </div>
              <div class="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <dt class="text-muted-foreground">Owner</dt>
                <dd>{{ detail.owner_email || 'Unknown' }}</dd>
              </div>
              <div class="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <dt class="text-muted-foreground">Members</dt>
                <dd>{{ detail.member_count }}</dd>
              </div>
              <div class="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <dt class="text-muted-foreground">Created</dt>
                <dd>{{ formatDate(detail.organization.created_at) }}</dd>
              </div>
            </dl>
          </Card>

          <!-- Subscription -->
          <Card>
            <template #header>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 class="text-base font-semibold">Subscription</h2>
                <Badge :variant="getStatusVariant(subscriptionForm.status)">
                  {{ subscriptionForm.status || 'none' }}
                </Badge>
              </div>
            </template>

            <div class="space-y-4">
              <div>
                <label class="mb-2 block text-sm font-medium">Plan</label>
                <Select
                  v-model="subscriptionForm.plan_id"
                  :options="planOptions"
                  placeholder="Select plan..."
                />
              </div>

              <div>
                <label class="mb-2 block text-sm font-medium">Status</label>
                <Select
                  v-model="subscriptionForm.status"
                  :options="statusOptions"
                  placeholder="Select status..."
                />
              </div>

              <div>
                <label class="mb-2 block text-sm font-medium">Trial end date</label>
                <Input v-model="subscriptionForm.trial_end_date" type="date" />
              </div>

              <div>
                <label class="mb-2 block text-sm font-medium">Current period end date</label>
                <Input v-model="subscriptionForm.current_period_end" type="date" />
              </div>

              <div class="grid gap-2">
                <Button variant="outline" :loading="saving" @click="grantLifetimePro">
                  <Icon name="lucide:gem" class="mr-2 h-4 w-4" />
                  Grant Lifetime Pro
                </Button>

                <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Input
                    v-model="extendTrialDays"
                    type="number"
                    min="1"
                    class-name="max-w-[140px]"
                  />
                  <Button variant="outline" class-name="w-full sm:w-auto" :loading="saving" @click="extendTrial">
                    <Icon name="lucide:clock-3" class="mr-2 h-4 w-4" />
                    Extend Trial
                  </Button>
                </div>
              </div>

              <Button :loading="saving" @click="saveSubscription">
                <Icon name="lucide:save" class="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </Card>
        </div>

        <!-- Members -->
        <Card padding="sm" class="!p-0 overflow-hidden">
          <div class="px-6 pt-6 pb-4">
            <h2 class="text-base font-semibold">Members</h2>
          </div>

          <DataTable
            :columns="memberColumns"
            :data="detail.members"
            empty-message="No members found for this organization."
            class="!border-0 !rounded-none [&_table]:min-w-[560px]"
          >
            <template #cell-role="{ value }">
              <Badge :variant="getRoleBadgeVariant(value as string)">
                {{ value }}
              </Badge>
            </template>
            <template #cell-created_at="{ value }">
              <span class="text-muted-foreground">{{ formatDate(value as string) }}</span>
            </template>
          </DataTable>
        </Card>

        <!-- Integrations -->
        <Card padding="sm" class="!p-0 overflow-hidden">
          <div class="px-6 pt-6 pb-4">
            <h2 class="text-base font-semibold">Integrations</h2>
          </div>

          <DataTable
            :columns="integrationColumns"
            :data="integrationRows"
            empty-message="No integrations configured."
            class="!border-0 !rounded-none [&_table]:min-w-[460px]"
          >
            <template #cell-platform="{ value }">
              <span class="capitalize font-medium">{{ value }}</span>
            </template>
            <template #cell-token_valid="{ value }">
              <Badge v-if="value === true" variant="success">Valid</Badge>
              <Badge v-else-if="value === false" variant="destructive">Invalid</Badge>
              <span v-else class="text-muted-foreground">—</span>
            </template>
            <template #cell-connected_at="{ value }">
              <span class="text-muted-foreground">{{ formatDate(value as string) }}</span>
            </template>
          </DataTable>
        </Card>

        <!-- Billing Events -->
        <Card padding="sm" class="!p-0 overflow-hidden">
          <div class="px-6 pt-6 pb-4">
            <h2 class="text-base font-semibold">Billing Event History</h2>
          </div>

          <DataTable
            :columns="billingColumns"
            :data="detail.billing_events"
            empty-message="No billing events found."
            class="!border-0 !rounded-none [&_table]:min-w-[760px]"
          >
            <template #cell-created_at="{ value }">
              <span class="text-muted-foreground">{{ formatDateTime(value as string) }}</span>
            </template>
            <template #cell-from_plan_id="{ value }">
              {{ value || '—' }}
            </template>
            <template #cell-to_plan_id="{ value }">
              {{ value || '—' }}
            </template>
          </DataTable>
        </Card>

        <!-- Danger Zone -->
        <Card class="!border-destructive/30">
          <template #header>
            <h2 class="text-base font-semibold text-destructive">Danger Zone</h2>
          </template>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-muted-foreground">
              Permanently delete this organization and all of its data. This cannot be undone.
            </p>
            <Button variant="destructive" class-name="w-full sm:w-auto" @click="deleteDialogOpen = true">
              <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
              Delete organization
            </Button>
          </div>
        </Card>

        <DeleteOrganizationDialog
          :open="deleteDialogOpen"
          :organization="orgForDelete"
          @close="deleteDialogOpen = false"
          @deleted="handleOrganizationDeleted"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import type { PlatformOrganizationDetail } from '~/composables/usePlatformAdmin'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'platform-admin']
})

const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

const { $toast } = useNuxtApp()
const route = useRoute()
const { fetchOrganizationDetail, updateSubscription } = usePlatformAdmin()

const organizationId = computed(() => {
  const param = route.params.id
  return typeof param === 'string' ? param : ''
})

const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const detail = ref<PlatformOrganizationDetail | null>(null)
const extendTrialDays = ref('7')
const deleteDialogOpen = ref(false)

const orgForDelete = computed(() =>
  detail.value
    ? { id: detail.value.organization.id, name: detail.value.organization.name }
    : null
)

const handleOrganizationDeleted = () => {
  navigateTo('/admin/organizations')
}

const subscriptionForm = reactive({
  plan_id: 'pro_monthly',
  status: 'active',
  trial_end_date: '',
  current_period_end: ''
})

const detailStats = computed(() => {
  if (!detail.value) return []
  return [
    { label: 'Projects', value: detail.value.stats.projects_count },
    { label: 'Environments', value: detail.value.stats.environments_count },
    { label: 'Environment Variables', value: detail.value.stats.variables_count }
  ]
})

const memberColumns = [
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'created_at', label: 'Joined' }
]

const integrationColumns = [
  { key: 'platform', label: 'Platform' },
  { key: 'name', label: 'Name' },
  { key: 'token_valid', label: 'Token' },
  { key: 'connected_at', label: 'Connected' }
]

const integrationRows = computed(() => {
  if (!detail.value) return []

  const rows: Array<{ platform: string; name: string; token_valid: boolean | null; connected_at: string }> = []

  for (const gh of detail.value.github_installations) {
    rows.push({
      platform: 'GitHub',
      name: `${gh.account_login} (${gh.account_type})`,
      token_valid: null,
      connected_at: gh.installed_at || ''
    })
  }

  for (const integration of detail.value.integrations) {
    rows.push({
      platform: integration.platform,
      name: integration.name,
      token_valid: integration.token_valid,
      connected_at: integration.connected_at
    })
  }

  return rows
})

const billingColumns = [
  { key: 'created_at', label: 'When' },
  { key: 'event_type', label: 'Event' },
  { key: 'from_plan_id', label: 'From' },
  { key: 'to_plan_id', label: 'To' }
]

const planOptions = [
  { label: 'Pro Monthly', value: 'pro_monthly' },
  { label: 'Pro Annual', value: 'pro_annual' }
]

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Trialing', value: 'trialing' },
  { label: 'Locked (paused)', value: 'paused' },
  { label: 'Canceled', value: 'canceled' }
]

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusVariant = (status?: string): string => {
  if (status === 'active') return 'success'
  if (status === 'trialing') return 'default'
  if (status === 'canceled') return 'destructive'
  return 'outline'
}

const getRoleBadgeVariant = (role: string): string => {
  if (role === 'owner') return 'default'
  if (role === 'admin') return 'warning'
  return 'outline'
}

const toDateInput = (isoDate: string | null): string => {
  if (!isoDate) return ''
  return isoDate.slice(0, 10)
}

const toIsoDate = (dateInput: string): string | null => {
  if (!dateInput) return null
  return new Date(`${dateInput}T00:00:00.000Z`).toISOString()
}

const syncFormFromDetail = () => {
  if (!detail.value?.subscription) {
    subscriptionForm.plan_id = 'pro_monthly'
    subscriptionForm.status = 'active'
    subscriptionForm.trial_end_date = ''
    subscriptionForm.current_period_end = ''
    return
  }

  const subscription = detail.value.subscription

  subscriptionForm.plan_id = subscription.plan_id
  subscriptionForm.status = subscription.status
  subscriptionForm.trial_end_date = toDateInput(subscription.trial_end_date)
  subscriptionForm.current_period_end = toDateInput(subscription.current_period_end)
}

const loadDetail = async () => {
  if (!organizationId.value) {
    error.value = 'Missing organization id'
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  try {
    detail.value = await fetchOrganizationDetail(organizationId.value)
    syncFormFromDetail()

    breadcrumbs.value = [
      { label: 'Admin', to: '/admin' },
      { label: 'Organizations', to: '/admin/organizations' },
      { label: detail.value?.organization.name || 'Detail' }
    ]
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load organization detail'
  } finally {
    loading.value = false
  }
}

const saveSubscription = async () => {
  if (!organizationId.value) return

  saving.value = true

  try {
    await updateSubscription(organizationId.value, {
      plan_id: subscriptionForm.plan_id,
      status: subscriptionForm.status,
      trial_end_date: toIsoDate(subscriptionForm.trial_end_date),
      current_period_end: toIsoDate(subscriptionForm.current_period_end)
    })

    $toast.success('Subscription updated')
    await loadDetail()
  } catch {
    // Error handled in composable
  } finally {
    saving.value = false
  }
}

const grantLifetimePro = async () => {
  if (!organizationId.value) return

  saving.value = true

  try {
    await updateSubscription(organizationId.value, {
      plan_id: 'pro_monthly',
      status: 'active',
      trial_start_date: null,
      trial_end_date: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      canceled_at: null
    })

    $toast.success('Lifetime Pro granted')
    await loadDetail()
  } catch {
    // Error handled in composable
  } finally {
    saving.value = false
  }
}

const extendTrial = async () => {
  if (!organizationId.value) return

  const days = Number.parseInt(extendTrialDays.value, 10)
  if (Number.isNaN(days) || days <= 0) {
    $toast.error('Extension days must be greater than zero')
    return
  }

  const baseDate = subscriptionForm.trial_end_date
    ? new Date(`${subscriptionForm.trial_end_date}T00:00:00.000Z`)
    : new Date()

  baseDate.setUTCDate(baseDate.getUTCDate() + days)

  saving.value = true

  try {
    await updateSubscription(organizationId.value, {
      status: 'trialing',
      trial_end_date: baseDate.toISOString()
    })

    $toast.success(`Trial extended by ${days} day${days === 1 ? '' : 's'}`)
    await loadDetail()
  } catch {
    // Error handled in composable
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  breadcrumbs.value = [
    { label: 'Admin', to: '/admin' },
    { label: 'Organizations', to: '/admin/organizations' },
    { label: 'Loading...' }
  ]
  loadDetail()
})
</script>
