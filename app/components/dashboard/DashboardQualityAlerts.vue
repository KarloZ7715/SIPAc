<script setup lang="ts">
import type { ApiSuccessResponse, ProfileSummaryResponse } from '~~/app/types'
import { WORKSPACE_PRODUCT_TYPE_OPTIONS } from '~~/app/config/workspace-product-type-options'

type DraftAlert = ProfileSummaryResponse['latestDrafts'][number]

const getProductTypeLabel = (type: DraftAlert['productType']) => {
  return WORKSPACE_PRODUCT_TYPE_OPTIONS.find((o) => o.value === type)?.label || type
}

const getRedFlags = (_draft: DraftAlert) => {
  return ['Pendiente de validación manual']
}

const formatDate = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, 10).split('-')
  if (!year || !month || !day) {
    return isoDate
  }

  return `${day}/${month}/${year}`
}

const { user } = useAuth()
const requestFetch = useRequestFetch() as typeof $fetch
const qualityAlertsKey = computed(
  () => `dashboard-quality-alerts:${user.value?._id ?? 'anonymous'}`,
)

const {
  data: alertsData,
  status,
  refresh,
} = await useAsyncData(
  () => qualityAlertsKey.value,
  async () => {
    const res = await requestFetch<ApiSuccessResponse<ProfileSummaryResponse>>('/api/profile')
    return res.data.latestDrafts.slice(0, 4)
  },
  { watch: [() => user.value?._id] },
)

const productsToReview = computed(() => alertsData.value || [])
const loading = computed(() => status.value === 'pending')
const hasError = computed(() => status.value === 'error')
const shouldShowLoadingState = computed(() => loading.value && productsToReview.value.length === 0)

onMounted(() => {
  if (status.value === 'error') {
    void refresh()
  }
})
</script>

<template>
  <div
    class="bg-surface border border-warning/20 rounded-2xl p-6 shadow-sm flex flex-col bg-gradient-to-br from-warning/5 via-transparent to-transparent"
  >
    <div class="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-warning/10 text-warning rounded-lg">
          <UIcon name="i-lucide-shield-alert" class="size-5" />
        </div>
        <div>
          <h2
            class="flex items-center gap-2 font-display text-lg font-medium leading-snug text-text"
          >
            Matriz de salud IA
            <UBadge v-if="productsToReview.length" color="warning" size="sm" variant="subtle">
              {{ productsToReview.length }} pendiente(s)
            </UBadge>
          </h2>
          <p class="text-sm leading-[1.6] text-text-muted">
            Productos en borrador que requieren confirmación antes de entrar al repositorio.
          </p>
        </div>
      </div>
      <div>
        <UButton
          to="/workspace-documents"
          color="neutral"
          variant="ghost"
          size="sm"
          trailing-icon="i-lucide-arrow-right"
        >
          Ver todo
        </UButton>
      </div>
    </div>

    <div v-if="shouldShowLoadingState" class="flex flex-col gap-3 animate-pulse">
      <div v-for="i in 3" :key="i" class="h-16 bg-surface-muted rounded-xl"></div>
    </div>

    <div
      v-else-if="hasError"
      class="flex flex-col items-center justify-center text-center py-6 text-text-soft gap-3"
    >
      <UIcon name="i-lucide-wifi-off" class="size-10 opacity-70" />
      <p class="text-sm">No se pudieron cargar las alertas de calidad.</p>
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

    <div v-else-if="productsToReview.length" class="flex flex-col gap-3">
      <NuxtLink
        v-for="prod in productsToReview"
        :key="prod._id"
        :to="{ path: '/workspace-documents', query: { productId: prod._id } }"
        class="group flex items-start gap-4 p-3.5 rounded-xl border border-border/70 bg-surface-elevated hover:border-warning/40 hover:shadow-sm transition-all"
      >
        <div class="bg-warning/10 p-2 rounded-lg text-warning mt-0.5 shrink-0">
          <UIcon name="i-lucide-file-warning" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="truncate font-display text-sm font-medium leading-snug text-text">
            {{ prod.title || 'Documento sin título' }}
          </h4>
          <p class="mt-1.5 flex items-center gap-2 text-sm text-text-soft">
            <UBadge color="neutral" variant="solid" size="xs">{{
              getProductTypeLabel(prod.productType)
            }}</UBadge>
            <span>Actualizado: {{ formatDate(prod.updatedAt) }}</span>
          </p>
          <div class="flex flex-wrap gap-2 mt-2">
            <div
              v-for="(flag, i) in getRedFlags(prod)"
              :key="i"
              class="flex items-center gap-1 rounded border border-warning/20 bg-warning/10 px-2 py-0.5 text-[0.72rem] text-warning"
            >
              <UIcon name="i-lucide-flag" class="size-3" />
              {{ flag }}
            </div>
          </div>
        </div>
        <UIcon
          name="i-lucide-chevron-right"
          class="size-4 text-text-soft mt-1 transition-transform group-hover:translate-x-0.5"
        />
      </NuxtLink>
    </div>

    <div v-else class="flex flex-col items-center justify-center text-center py-6 text-text-soft">
      <UIcon name="i-lucide-shield-check" class="size-12 mb-3 text-success-500 opacity-80" />
      <h3 class="font-display text-lg font-medium text-text">¡Todo verde!</h3>
      <p class="mt-1 max-w-[250px] text-sm leading-[1.6] text-text-muted">
        Tus documentos recientes han pasado satisfactoriamente las validaciones del motor de IA.
      </p>
    </div>
  </div>
</template>
