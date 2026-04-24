<script setup lang="ts">
import { computed } from 'vue'
import { Chart as ChartJS, Title, Tooltip, ArcElement, type ChartOptions } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import {
  DASHBOARD_CHART_COLORS,
  DASHBOARD_CHART_TOOLTIP_COLORS,
} from '~~/app/config/ui-chart-tokens'
import { WORKSPACE_PRODUCT_TYPE_OPTIONS } from '~~/app/config/workspace-product-type-options'
import type { ProductDashboardSummary } from '~~/app/types'

ChartJS.register(ArcElement, Title, Tooltip)

const props = defineProps<{
  summary: ProductDashboardSummary | null
  loading?: boolean
}>()

const chartOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '64%',
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: DASHBOARD_CHART_TOOLTIP_COLORS.background,
      titleColor: DASHBOARD_CHART_TOOLTIP_COLORS.title,
      bodyColor: DASHBOARD_CHART_TOOLTIP_COLORS.body,
      padding: 12,
      cornerRadius: 8,
    },
  },
}

const chartData = computed(() => {
  const rawData = props.summary?.byType || []
  const labels = rawData.map(
    (t) =>
      WORKSPACE_PRODUCT_TYPE_OPTIONS.find((o) => o.value === t.productType)?.label || t.productType,
  )
  const data = rawData.map((t) => t.total)

  return {
    labels,
    datasets: [
      {
        data,
        backgroundColor: data.map(
          (_, index) => DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length],
        ),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4,
      },
    ],
  }
})

const shouldShowLoadingState = computed(
  () => Boolean(props.loading) && chartData.value.labels.length === 0,
)
</script>

<template>
  <div
    class="bg-surface border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col h-full min-h-[320px]"
  >
    <div class="flex items-center gap-3 mb-6">
      <div class="p-2 bg-primary/10 text-primary-600 rounded-lg">
        <UIcon name="i-lucide-pie-chart" class="size-5" />
      </div>
      <div>
        <h3 class="font-display text-lg font-medium leading-snug text-text">
          Distribución por tipo
        </h3>
        <p class="text-xs leading-[1.43] text-text-muted">Composición de productos confirmados</p>
      </div>
    </div>

    <Transition name="fade" mode="out-in">
      <div v-if="shouldShowLoadingState" class="flex-1 flex items-center justify-center h-[220px]">
        <div class="skeleton-shimmer w-40 h-40 rounded-full"></div>
      </div>
      <div
        v-else-if="!chartData.labels.length"
        class="flex-1 flex flex-col items-center justify-center text-text-soft"
      >
        <UIcon name="i-lucide-file-x-2" class="size-10 mb-2 opacity-30" />
        <p class="text-sm">Sin datos de distribución disponibles</p>
      </div>
      <div v-else class="flex-1 h-[220px] relative">
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
    </Transition>
  </div>
</template>
