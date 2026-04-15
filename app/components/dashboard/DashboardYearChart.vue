<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  BarElement,
  CategoryScale,
  LinearScale,
  type ChartOptions,
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import type { ProductDashboardSummary } from '~~/app/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip)

const props = defineProps<{
  summary: ProductDashboardSummary | null
  loading?: boolean
}>()

const skeletonHeights = ['32%', '56%', '74%', '48%', '68%']
const barPalette = ['#2f855a', '#2b6cb0', '#b7791f', '#805ad5', '#0f766e', '#be123c', '#0369a1']

const chartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#112e1d',
      titleColor: '#fff',
      bodyColor: '#fff',
      padding: 12,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: '#5f6f64' },
    },
    y: {
      grid: { color: 'rgba(16, 35, 25, 0.06)' },
      border: { display: false },
      beginAtZero: true,
      ticks: { precision: 0 },
    },
  },
  elements: {
    bar: { borderRadius: 6 },
  },
}

const chartData = computed(() => {
  const labels = props.summary?.byYear.map((y) => y.year.toString()) || []
  const data = props.summary?.byYear.map((y) => y.total) || []

  return {
    labels,
    datasets: [
      {
        label: 'Documentos',
        data,
        backgroundColor: data.map((_, index) => barPalette[index % barPalette.length]),
        hoverBackgroundColor: data.map((_, index) => barPalette[index % barPalette.length]),
      },
    ],
  }
})
</script>

<template>
  <div
    class="bg-surface border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col h-full min-h-[320px]"
  >
    <div class="flex items-center gap-3 mb-6">
      <div class="p-2 bg-primary/10 text-primary-600 rounded-lg">
        <UIcon name="i-lucide-bar-chart-3" class="size-5" />
      </div>
      <div>
        <h3 class="font-display text-lg font-medium leading-snug text-text">Evolución histórica</h3>
        <p class="text-xs leading-[1.43] text-text-muted">Productos confirmados por año</p>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-end gap-2 animate-pulse h-[220px]">
      <div
        v-for="(height, i) in skeletonHeights"
        :key="`skeleton-${i}`"
        class="bg-surface-muted rounded-t-md flex-1"
        :style="{ height }"
      ></div>
    </div>
    <div
      v-else-if="!chartData.labels.length"
      class="flex-1 flex flex-col items-center justify-center text-text-soft"
    >
      <UIcon name="i-lucide-file-x-2" class="size-10 mb-2 opacity-30" />
      <p class="text-sm">Sin histórico disponible para este filtro</p>
    </div>
    <div v-else class="flex-1 h-[220px] relative">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
