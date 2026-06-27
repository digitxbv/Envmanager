<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Platform Admin</h1>
          <p class="text-sm text-muted-foreground mt-1">
            Manage organizations and subscriptions across the platform
          </p>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" @click="navigateTo('/admin/proxy-templates')">
            <Icon name="lucide:layout-template" class="mr-2 h-4 w-4" />
            Proxy Templates
          </Button>
          <Button @click="navigateTo('/admin/organizations')">
            <Icon name="lucide:building-2" class="mr-2 h-4 w-4" />
            Manage Organizations
          </Button>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-16">
        <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-primary" />
      </div>

      <Card v-else-if="error" class-name="!border-destructive/20 !bg-destructive/5">
        <p class="text-sm text-destructive">{{ error }}</p>
      </Card>

      <template v-else-if="stats">
        <div class="grid gap-4 md:grid-cols-3">
          <Card v-for="stat in statCards" :key="stat.label">
            <p class="text-sm text-muted-foreground">{{ stat.label }}</p>
            <p class="mt-2 text-3xl font-semibold">{{ stat.value }}</p>
          </Card>
        </div>

        <Card padding="sm" class="!p-0 overflow-hidden">
          <div class="px-6 pt-6 pb-4">
            <h2 class="text-base font-semibold">Plan distribution</h2>
          </div>

          <DataTable
            :columns="planColumns"
            :data="stats.plan_distribution"
            empty-message="No subscription records found."
            class="!border-0 !rounded-none [&_table]:min-w-[520px]"
          >
            <template #cell-plan_id="{ value }">
              {{ formatPlanName(value as string) }}
            </template>
            <template #cell-status="{ value }">
              <Badge :variant="getStatusVariant(value as string)">
                {{ value }}
              </Badge>
            </template>
            <template #cell-count="{ value }">
              <span class="font-medium">{{ value }}</span>
            </template>
          </DataTable>
        </Card>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import type { PlatformStats } from '~/composables/usePlatformAdmin'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'platform-admin']
})

const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

const { fetchStats } = usePlatformAdmin()

const loading = ref(true)
const error = ref<string | null>(null)
const stats = ref<PlatformStats | null>(null)

const statCards = computed(() => {
  if (!stats.value) return []
  return [
    { label: 'Total organizations', value: stats.value.total_organizations },
    { label: 'Total users', value: stats.value.total_users },
    { label: 'Plan buckets', value: stats.value.plan_distribution.length },
    { label: 'Total projects', value: stats.value.total_projects },
    { label: 'Total environments', value: stats.value.total_environments },
    { label: 'Total environment variables', value: stats.value.total_variables }
  ]
})

const planColumns = [
  { key: 'plan_id', label: 'Plan' },
  { key: 'status', label: 'Status' },
  { key: 'count', label: 'Count' }
]

const formatPlanName = (planId: string): string => {
  if (planId === 'pro_monthly') return 'Pro Monthly'
  if (planId === 'pro_annual') return 'Pro Annual'
  if (planId === 'free') return 'Free'
  return planId
}

const getStatusVariant = (status: string): string => {
  if (status === 'active') return 'success'
  if (status === 'trialing') return 'default'
  if (status === 'canceled') return 'destructive'
  return 'outline'
}

const loadStats = async () => {
  loading.value = true
  error.value = null

  try {
    stats.value = await fetchStats()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load platform stats'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  breadcrumbs.value = [
    { label: 'Admin' }
  ]
  loadStats()
})
</script>
