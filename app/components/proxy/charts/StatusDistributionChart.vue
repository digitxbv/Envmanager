<template>
  <div class="relative">
    <div v-if="isEmpty" class="absolute inset-0 flex flex-col items-center justify-center z-10 bg-card/80 rounded-lg">
      <Icon name="lucide:pie-chart" class="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p class="text-sm font-medium text-muted-foreground">No data yet</p>
      <p class="text-xs text-muted-foreground/60 mt-1 text-center px-4">Analytics will appear after your proxy functions start receiving requests</p>
    </div>
    <ClientOnly>
      <Doughnut :data="chartData" :options="chartOptions" class="max-h-64" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import type { DailyStats } from '~/types/proxy.types'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  stats: DailyStats[]
}>()

const totals = computed(() => {
  let success = 0
  let clientError = 0
  let serverError = 0
  for (const s of props.stats) {
    success += s.success_count ?? 0
    clientError += s.client_error_count ?? 0
    serverError += s.server_error_count ?? 0
  }
  return { success, clientError, serverError }
})

const isEmpty = computed(() => {
  const { success, clientError, serverError } = totals.value
  return success + clientError + serverError === 0
})

const chartData = computed(() => ({
  labels: [
    `2xx Success (${totals.value.success})`,
    `4xx Client Error (${totals.value.clientError})`,
    `5xx Server Error (${totals.value.serverError})`,
  ],
  datasets: [
    {
      data: isEmpty.value
        ? [1, 1, 1]
        : [totals.value.success, totals.value.clientError, totals.value.serverError],
      backgroundColor: isEmpty.value
        ? ['rgba(100,100,100,0.2)', 'rgba(100,100,100,0.2)', 'rgba(100,100,100,0.2)']
        : ['rgba(44, 221, 109, 0.8)', 'rgba(251, 146, 60, 0.8)', 'rgba(239, 68, 68, 0.8)'],
      borderColor: isEmpty.value
        ? ['rgba(100,100,100,0.3)', 'rgba(100,100,100,0.3)', 'rgba(100,100,100,0.3)']
        : ['rgb(44, 221, 109)', 'rgb(251, 146, 60)', 'rgb(239, 68, 68)'],
      borderWidth: 1,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: '60%',
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
      callbacks: {
        label: (ctx: any) => {
          if (isEmpty.value) return ' No data'
          return ` ${ctx.label}`
        },
      },
    },
  },
}
</script>
