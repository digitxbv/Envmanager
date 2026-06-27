// =====================================================
// Proxy Analytics Composable
// =====================================================
// Fetches proxy analytics from proxy_analytics_daily and proxy_analytics_hourly views.

import type { Database } from '~/types/database.types'
import type { DailyStats, HourlyStats, ProxyUsageSummary } from '~/types/proxy.types'

export function useProxyAnalytics(organizationId: Ref<string>) {
  const client = useSupabaseClient<Database>()

  const dailyStats = ref<DailyStats[]>([])
  const hourlyStats = ref<HourlyStats[]>([])
  const topProxies = ref<ProxyUsageSummary[]>([])
  const loading = ref(false)

  async function fetchDailyStats(proxyId?: string, days = 30) {
    loading.value = true
    try {
      const since = new Date()
      since.setDate(since.getDate() - days)
      const sinceStr = since.toISOString().split('T')[0]

      let query = client
        .from('proxy_analytics_daily')
        .select('*')
        .eq('organization_id', organizationId.value)
        .gte('day', sinceStr)
        .order('day', { ascending: false })

      if (proxyId) {
        query = query.eq('proxy_function_id', proxyId)
      }

      const { data, error } = await query
      if (error) throw error
      dailyStats.value = (data ?? []) as DailyStats[]
    } catch (err) {
      console.error('[useProxyAnalytics] fetchDailyStats error:', err)
      dailyStats.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchHourlyStats(proxyId?: string) {
    try {
      let query = client
        .from('proxy_analytics_hourly')
        .select('*')
        .eq('organization_id', organizationId.value)
        .order('hour', { ascending: false })

      if (proxyId) {
        query = query.eq('proxy_function_id', proxyId)
      }

      const { data, error } = await query
      if (error) throw error
      hourlyStats.value = (data ?? []) as HourlyStats[]
    } catch (err) {
      console.error('[useProxyAnalytics] fetchHourlyStats error:', err)
      hourlyStats.value = []
    }
  }

  async function fetchTopProxies(limit = 10) {
    loading.value = true
    try {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const { data: dailyData, error } = await client
        .from('proxy_analytics_daily')
        .select('proxy_function_id, total_calls, success_count, avg_response_time_ms')
        .eq('organization_id', organizationId.value)
        .gte('day', monthStart)

      if (error) throw error

      // Aggregate by proxy_function_id
      const proxyMap: Record<string, { total_calls: number; success_count: number; total_time: number; count: number }> = {}
      for (const row of dailyData ?? []) {
        const id = row.proxy_function_id
        if (!id) continue
        if (!proxyMap[id]) {
          proxyMap[id] = { total_calls: 0, success_count: 0, total_time: 0, count: 0 }
        }
        proxyMap[id].total_calls += row.total_calls ?? 0
        proxyMap[id].success_count += row.success_count ?? 0
        proxyMap[id].total_time += (row.avg_response_time_ms ?? 0) * (row.total_calls ?? 0)
        proxyMap[id].count += row.total_calls ?? 0
      }

      // Fetch proxy names
      const proxyIds = Object.keys(proxyMap)
      if (proxyIds.length === 0) {
        topProxies.value = []
        return
      }

      const { data: proxies } = await client
        .from('proxy_functions')
        .select('id, name')
        .in('id', proxyIds)

      const nameMap: Record<string, string> = {}
      for (const p of proxies ?? []) {
        nameMap[p.id] = p.name
      }

      const summaries: ProxyUsageSummary[] = proxyIds.map(id => {
        const agg = proxyMap[id]
        if (!agg) {
          return {
            proxy_function_id: id,
            proxy_name: nameMap[id] ?? 'Unknown',
            total_calls: 0,
            success_rate: 0,
            avg_response_time_ms: 0,
          }
        }
        return {
          proxy_function_id: id,
          proxy_name: nameMap[id] ?? 'Unknown',
          total_calls: agg.total_calls,
          success_rate: agg.total_calls > 0 ? agg.success_count / agg.total_calls : 0,
          avg_response_time_ms: agg.count > 0 ? Math.round(agg.total_time / agg.count) : 0,
        }
      })

      summaries.sort((a, b) => b.total_calls - a.total_calls)
      topProxies.value = summaries.slice(0, limit)
    } catch (err) {
      console.error('[useProxyAnalytics] fetchTopProxies error:', err)
      topProxies.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchProxyOverview(proxyId: string) {
    try {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const sinceStr = since.toISOString().split('T')[0]

      const { data, error } = await client
        .from('proxy_analytics_daily')
        .select('total_calls, success_count, avg_response_time_ms, p95_response_time_ms')
        .eq('organization_id', organizationId.value)
        .eq('proxy_function_id', proxyId)
        .gte('day', sinceStr)

      if (error) throw error

      const rows = data ?? []
      let totalCalls = 0
      let successCount = 0
      let weightedTime = 0
      let maxP95 = 0

      for (const row of rows) {
        totalCalls += row.total_calls ?? 0
        successCount += row.success_count ?? 0
        weightedTime += (row.avg_response_time_ms ?? 0) * (row.total_calls ?? 0)
        if ((row.p95_response_time_ms ?? 0) > maxP95) {
          maxP95 = row.p95_response_time_ms ?? 0
        }
      }

      return {
        total_calls: totalCalls,
        success_rate: totalCalls > 0 ? successCount / totalCalls : 0,
        avg_response_time_ms: totalCalls > 0 ? Math.round(weightedTime / totalCalls) : 0,
        p95_response_time_ms: maxP95,
      }
    } catch (err) {
      console.error('[useProxyAnalytics] fetchProxyOverview error:', err)
      return null
    }
  }

  return {
    dailyStats: readonly(dailyStats),
    hourlyStats: readonly(hourlyStats),
    topProxies: readonly(topProxies),
    loading: readonly(loading),
    fetchDailyStats,
    fetchHourlyStats,
    fetchTopProxies,
    fetchProxyOverview,
  }
}
