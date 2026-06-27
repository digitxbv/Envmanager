<template>
  <div class="relative">
    <div v-if="isEmpty" class="absolute inset-0 flex flex-col items-center justify-center z-10 bg-card/80 rounded-lg">
      <Icon name="lucide:activity" class="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p class="text-sm font-medium text-muted-foreground">No data yet</p>
      <p class="text-xs text-muted-foreground/60 mt-1 text-center px-4">Analytics will appear after your proxy functions start receiving requests</p>
    </div>
    <ClientOnly>
      <Line :data="chartData" :options="chartOptions" class="max-h-64" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { DailyStats } from '~/types/proxy.types'
import { generateEmptyLabels, generateEmptyData } from '~/lib/chart-utils'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const props = defineProps<{
  stats: DailyStats[]
}>()

const isEmpty = computed(() => props.stats.length === 0)

const sorted = computed(() => [...props.stats].sort((a, b) => a.day.localeCompare(b.day)))

const labels = computed(() => sorted.value.map(s => {
  const d = new Date(s.day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}))

const chartData = computed(() => ({
  labels: isEmpty.value ? generateEmptyLabels() : labels.value,
  datasets: [
    {
      label: 'Avg Response (ms)',
      data: isEmpty.value ? generateEmptyData() : sorted.value.map(s => s.avg_response_time_ms ?? 0),
      borderColor: 'rgb(139, 92, 246)',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      tension: 0.3,
      fill: true,
    },
    {
      label: 'P95 Response (ms)',
      data: isEmpty.value ? generateEmptyData() : sorted.value.map(s => s.p95_response_time_ms ?? 0),
      borderColor: 'rgb(236, 72, 153)',
      backgroundColor: 'rgba(236, 72, 153, 0.05)',
      tension: 0.3,
      fill: false,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: 'hsl(var(--muted-foreground))',
        boxWidth: 12,
        padding: 12,
        font: { size: 11 },
      },
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y}ms`,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: 'hsl(var(--muted-foreground))', font: { size: 10 } },
      grid: { color: 'hsl(var(--border))' },
    },
    y: {
      beginAtZero: true,
      ticks: {
        color: 'hsl(var(--muted-foreground))',
        font: { size: 10 },
        callback: (val: number | string) => `${val}ms`,
      },
      grid: { color: 'hsl(var(--border))' },
    },
  },
}

</script>
