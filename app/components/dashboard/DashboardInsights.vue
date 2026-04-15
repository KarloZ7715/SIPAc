<script setup lang="ts">
import { computed } from 'vue'
import type { ApiSuccessResponse, DashboardInsightItem, ProductType } from '~~/app/types'

const props = defineProps<{
  productTypes: ProductType[]
  owner?: string
  from?: string
  to?: string
  isAdmin?: boolean
}>()

const { user } = useAuth()
const requestFetch = useRequestFetch() as typeof $fetch

const insightsKey = computed(() =>
  [
    'dashboard-insights',
    user.value?._id ?? 'anonymous',
    props.productTypes.slice().sort().join('|') || 'all',
    props.owner ?? 'self',
    props.from ?? 'none',
    props.to ?? 'none',
  ].join(':'),
)

const {
  data: insightsPayload,
  status,
  refresh,
} = await useAsyncData(
  () => insightsKey.value,
  () =>
    requestFetch<ApiSuccessResponse<DashboardInsightItem[]>>('/api/dashboard/insights', {
      query: {
        productType: props.productTypes.length > 0 ? props.productTypes : undefined,
        owner: props.isAdmin ? props.owner : undefined,
        from: props.from || undefined,
        to: props.to || undefined,
      },
    }),
  {
    watch: [
      () => user.value?._id,
      () => props.productTypes.join('|'),
      () => props.owner,
      () => props.from,
      () => props.to,
      () => props.isAdmin,
    ],
  },
)

const insights = computed(() => insightsPayload.value?.data ?? [])
const loading = computed(() => status.value === 'pending')
const hasError = computed(() => status.value === 'error')

/** Conserva focus, fromInsight u otros query del CTA principal al abrir otro producto de ejemplo. */
function exampleWorkspaceUrl(productId: string, insight: DashboardInsightItem): string {
  try {
    const u = new URL(insight.href, 'http://local.test')
    const params = new URLSearchParams()
    params.set('productId', productId)
    u.searchParams.forEach((value, key) => {
      if (key !== 'productId') {
        params.set(key, value)
      }
    })
    return `/workspace-documents?${params.toString()}`
  } catch {
    return `/workspace-documents?productId=${encodeURIComponent(productId)}`
  }
}

onMounted(() => {
  if (status.value === 'error') {
    void refresh()
  }
})
</script>

<template>
  <div class="bg-surface border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 border-b border-border/50 pb-4">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 text-primary-600 rounded-lg">
          <UIcon name="i-lucide-lightbulb" class="size-5" />
        </div>
        <div>
          <h2 class="font-display text-lg font-medium leading-snug text-text">
            Insights proactivos
          </h2>
          <p class="text-sm leading-[1.6] text-text-muted">
            Señales accionables según los mismos filtros que el tablero (repositorio confirmado)
          </p>
        </div>
      </div>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        @click="refresh()"
      >
        Actualizar
      </UButton>
    </div>

    <div v-if="loading" class="flex flex-col gap-4 animate-pulse">
      <div v-for="i in 2" :key="i" class="h-24 bg-surface-muted rounded-xl"></div>
    </div>

    <div
      v-else-if="hasError"
      class="flex flex-col items-center justify-center text-center py-6 text-text-soft gap-3"
    >
      <UIcon name="i-lucide-cloud-off" class="size-10 opacity-70" />
      <p class="text-sm">No fue posible calcular insights en este momento.</p>
      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        @click="refresh()"
      >
        Reintentar
      </UButton>
    </div>

    <div v-else-if="insights.length" class="flex flex-col gap-3">
      <div
        v-for="insight in insights"
        :key="insight.id"
        class="border border-border/60 rounded-xl p-4 transition-all hover:border-primary/40 hover:shadow-sm relative overflow-hidden group"
      >
        <div
          class="absolute left-0 top-0 bottom-0 w-1"
          :class="{
            'bg-yellow-500': insight.severity === 'warning',
            'bg-primary-500': insight.severity === 'success',
            'bg-sky-500': insight.severity === 'info',
          }"
        ></div>

        <div class="pl-2">
          <h4
            class="flex items-center gap-2 font-display text-sm font-medium leading-snug text-text"
          >
            <UIcon
              :name="
                insight.severity === 'warning'
                  ? 'i-lucide-alert-triangle'
                  : insight.severity === 'success'
                    ? 'i-lucide-trending-up'
                    : 'i-lucide-info'
              "
              :class="{
                'text-yellow-600': insight.severity === 'warning',
                'text-primary-600': insight.severity === 'success',
                'text-sky-600': insight.severity === 'info',
              }"
              class="size-4"
            />
            {{ insight.title }}
          </h4>
          <p class="mt-1.5 text-xs leading-[1.43] text-text-muted">{{ insight.description }}</p>
          <div
            v-if="insight.sampleProductIds?.length && insight.sampleProductIds.length > 1"
            class="mt-2 flex flex-wrap gap-1.5"
          >
            <span class="text-[10px] uppercase tracking-wide text-text-soft">Ejemplos:</span>
            <UButton
              v-for="pid in insight.sampleProductIds.slice(0, 3)"
              :key="`${insight.id}-${pid}`"
              :to="exampleWorkspaceUrl(pid, insight)"
              size="xs"
              color="neutral"
              variant="soft"
              class="rounded-full"
            >
              Abrir
            </UButton>
          </div>
          <div class="mt-3 flex flex-wrap items-center justify-end gap-2">
            <UButton
              v-if="insight.secondaryHref"
              :to="insight.secondaryHref"
              size="xs"
              color="neutral"
              variant="soft"
            >
              {{ insight.secondaryCtaLabel ?? 'Más acciones' }}
            </UButton>
            <UButton
              :to="insight.href"
              variant="link"
              color="primary"
              size="xs"
              class="p-0 font-medium group-hover:underline"
              trailing-icon="i-lucide-arrow-right"
            >
              {{ insight.ctaLabel }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center text-center py-6 text-text-soft">
      <UIcon name="i-lucide-check-circle-2" class="size-10 mb-2 opacity-50" />
      <p class="text-sm">Sin alertas con los filtros actuales. Buen trabajo.</p>
    </div>
  </div>
</template>
