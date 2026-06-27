<template>
  <div class="space-y-6">
    <!-- Controls -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <!-- Proxy filter -->
      <div class="flex items-center gap-2">
        <label class="text-sm text-muted-foreground whitespace-nowrap">Filter by proxy:</label>
        <select
          v-model="selectedProxyId"
          class="flex h-8 rounded-md border border-input bg-card text-card-foreground px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          @change="onFilterChange"
        >
          <option value="">All proxies</option>
          <option v-for="proxy in proxies" :key="proxy.id" :value="proxy.id">
            {{ proxy.name }}
          </option>
        </select>
      </div>

      <!-- Refresh -->
      <button
        class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        :disabled="loading"
        @click="refresh"
      >
        <Icon name="lucide:refresh-cw" class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
        Refresh
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <LoadingSpinner />
    </div>

    <template v-else>
      <!-- 2x2 grid -->
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- Invocation Trends -->
        <div class="rounded-lg border border-border bg-card p-4">
          <div class="mb-3 flex items-center gap-2">
            <Icon name="lucide:trending-up" class="h-4 w-4 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">Invocation Trends (Last 30 days)</h3>
          </div>
          <InvocationTrendChart :stats="dailyStats as DailyStats[]" />
        </div>

        <!-- Status Distribution -->
        <div class="rounded-lg border border-border bg-card p-4">
          <div class="mb-3 flex items-center gap-2">
            <Icon name="lucide:pie-chart" class="h-4 w-4 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">Status Distribution (This month)</h3>
          </div>
          <StatusDistributionChart :stats="monthStats as DailyStats[]" />
        </div>

        <!-- Response Time -->
        <div class="rounded-lg border border-border bg-card p-4">
          <div class="mb-3 flex items-center gap-2">
            <Icon name="lucide:activity" class="h-4 w-4 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">Response Time (Last 30 days)</h3>
          </div>
          <ResponseTimeChart :stats="dailyStats as DailyStats[]" />
        </div>

        <!-- Top Proxies -->
        <div class="rounded-lg border border-border bg-card p-4">
          <div class="mb-3 flex items-center gap-2">
            <Icon name="lucide:bar-chart-2" class="h-4 w-4 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">Top Proxies by Usage (This month)</h3>
          </div>
          <TopProxiesChart :proxies="topProxies as ProxyUsageSummary[]" @proxy-click="onProxyClick" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DailyStats, ProxyUsageSummary } from '~/types/proxy.types'
import InvocationTrendChart from '~/components/proxy/charts/InvocationTrendChart.vue'
import StatusDistributionChart from '~/components/proxy/charts/StatusDistributionChart.vue'
import ResponseTimeChart from '~/components/proxy/charts/ResponseTimeChart.vue'
import TopProxiesChart from '~/components/proxy/charts/TopProxiesChart.vue'

const props = defineProps<{
  organizationId: string
  proxies: { id: string; name: string }[]
}>()

const selectedProxyId = ref('')

const orgIdRef = computed(() => props.organizationId)
const {
  dailyStats,
  topProxies,
  loading,
  fetchDailyStats,
  fetchTopProxies,
} = useProxyAnalytics(orgIdRef)

// Stats filtered to current month for status distribution
const monthStats = computed<DailyStats[]>(() => {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  return (dailyStats.value as DailyStats[]).filter(s => s.day >= monthStart)
})

async function refresh() {
  await Promise.all([
    fetchDailyStats(selectedProxyId.value || undefined, 30),
    fetchTopProxies(5),
  ])
}

async function onFilterChange() {
  await fetchDailyStats(selectedProxyId.value || undefined, 30)
}

function onProxyClick(proxyId: string) {
  selectedProxyId.value = proxyId
  fetchDailyStats(proxyId, 30)
}

onMounted(() => {
  refresh()
})
</script>
