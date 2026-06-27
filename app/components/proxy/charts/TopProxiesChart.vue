<template>
  <div class="relative">
    <div v-if="isEmpty" class="absolute inset-0 flex flex-col items-center justify-center z-10 bg-card/80 rounded-lg">
      <Icon name="lucide:bar-chart" class="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p class="text-sm font-medium text-muted-foreground">No data yet</p>
      <p class="text-xs text-muted-foreground/60 mt-1 text-center px-4">Analytics will appear after your proxy functions start receiving requests</p>
    </div>
    <ClientOnly>
      <Bar :data="chartData" :options="chartOptions" class="max-h-64" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import type { ProxyUsageSummary } from '~/types/proxy.types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps<{
  proxies: ProxyUsageSummary[]
}>()

const emit = defineEmits<{
  'proxy-click': [proxyId: string]
}>()

const top5 = computed(() => props.proxies.slice(0, 5))
const isEmpty = computed(() => top5.value.length === 0)

const chartData = computed(() => ({
  labels: isEmpty.value ? ['No proxies yet'] : top5.value.map(p => p.proxy_name),
  datasets: [
    {
      label: 'Total Calls (this month)',
      data: isEmpty.value ? [0] : top5.value.map(p => p.total_calls),
      backgroundColor: isEmpty.value
        ? ['rgba(100,100,100,0.2)']
        : [
            'rgba(44, 221, 109, 0.7)',
            'rgba(59, 130, 246, 0.7)',
            'rgba(139, 92, 246, 0.7)',
            'rgba(251, 146, 60, 0.7)',
            'rgba(236, 72, 153, 0.7)',
          ],
      borderColor: isEmpty.value
        ? ['rgba(100,100,100,0.3)']
        : [
            'rgb(44, 221, 109)',
            'rgb(59, 130, 246)',
            'rgb(139, 92, 246)',
            'rgb(251, 146, 60)',
            'rgb(236, 72, 153)',
          ],
      borderWidth: 1,
      borderRadius: 4,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: true,
  indexAxis: 'y' as const,
  onClick: (_event: any, elements: any[]) => {
    if (isEmpty.value || elements.length === 0) return
    const index = elements[0].index
    const proxy = top5.value[index]
    if (proxy) {
      emit('proxy-click', proxy.proxy_function_id)
    }
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: any) => ` ${ctx.parsed.x} calls`,
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: { color: 'hsl(var(--muted-foreground))', font: { size: 10 } },
      grid: { color: 'hsl(var(--border))' },
    },
    y: {
      ticks: { color: 'hsl(var(--muted-foreground))', font: { size: 11 } },
      grid: { display: false },
    },
  },
}))
</script>
