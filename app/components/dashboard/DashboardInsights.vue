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
const shouldShowLoadingState = computed(() => loading.value && insights.value.length === 0)

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
  <div class="insights-panel flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 border-b border-border/40 pb-4">
      <div class="flex items-center gap-3">
        <div class="insights-panel__badge">
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

    <Transition name="fade" mode="out-in">
      <div v-if="shouldShowLoadingState" class="flex flex-col gap-4">
        <div v-for="i in 2" :key="i" class="skeleton-shimmer h-24 rounded-xl"></div>
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
          class="insight-card group"
          :data-severity="insight.severity"
        >
          <div class="insight-card__rail" aria-hidden="true"></div>

          <div class="pl-3">
            <h4
              class="flex items-center gap-2 font-display text-sm font-medium leading-snug text-text"
            >
              <span class="insight-card__icon">
                <UIcon
                  :name="
                    insight.severity === 'warning'
                      ? 'i-lucide-alert-triangle'
                      : insight.severity === 'success'
                        ? 'i-lucide-trending-up'
                        : 'i-lucide-info'
                  "
                  class="size-4"
                />
              </span>
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
    </Transition>
  </div>
</template>

<style scoped>
.insights-panel {
  position: relative;
  padding: 1.5rem;
  border-radius: 1.4rem;
  border: 1px solid rgb(var(--color-border-rgb, 235 232 222) / 0.85);
  background:
    radial-gradient(circle at 0% 0%, rgb(201 100 66 / 0.05), transparent 55%),
    linear-gradient(180deg, rgb(255 255 255 / 0.96), rgb(250 249 245 / 0.92));
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.8) inset,
    0 12px 36px -26px rgb(28 25 23 / 0.12);
  overflow: hidden;
}

.insights-panel::before {
  content: '';
  position: absolute;
  inset: -1px -1px auto -1px;
  height: 3px;
  background: linear-gradient(90deg, transparent, rgb(201 100 66 / 0.28), transparent);
  pointer-events: none;
}

.insights-panel__badge {
  width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, rgb(201 100 66 / 0.14), rgb(201 100 66 / 0.06));
  color: rgb(201 100 66);
  box-shadow: inset 0 0 0 1px rgb(201 100 66 / 0.18);
}

.insight-card {
  position: relative;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgb(235 232 222 / 0.85);
  background: linear-gradient(180deg, rgb(255 255 255 / 0.8), rgb(250 249 245 / 0.6));
  overflow: hidden;
  transition:
    border-color 220ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.insight-card:hover {
  border-color: rgb(201 100 66 / 0.35);
  box-shadow: 0 10px 28px -22px rgb(201 100 66 / 0.35);
  transform: translateY(-1px);
}

.insight-card__rail {
  position: absolute;
  top: 0.6rem;
  bottom: 0.6rem;
  left: 0;
  width: 3px;
  border-radius: 999px;
  background: var(--rail-color, rgb(201 100 66 / 0.75));
  opacity: 0.85;
}

.insight-card__icon {
  width: 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.55rem;
  background: var(--rail-soft, rgb(201 100 66 / 0.12));
  color: var(--rail-color, rgb(201 100 66));
}

.insight-card[data-severity='warning'] {
  --rail-color: rgb(180 83 9);
  --rail-soft: rgb(180 83 9 / 0.14);
}
.insight-card[data-severity='success'] {
  --rail-color: rgb(66 130 88);
  --rail-soft: rgb(66 130 88 / 0.14);
}
.insight-card[data-severity='info'] {
  --rail-color: rgb(125 83 54);
  --rail-soft: rgb(125 83 54 / 0.12);
}
</style>
