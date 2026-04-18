<script setup lang="ts">
import type { ApiSuccessResponse, ProductDashboardSummary, ProductType } from '~~/app/types'

const productTypeOptions = [
  { label: 'Artículo', value: 'article' },
  { label: 'Ponencia', value: 'conference_paper' },
  { label: 'Tesis', value: 'thesis' },
  { label: 'Certificado', value: 'certificate' },
  { label: 'Proyecto', value: 'research_project' },
  { label: 'Libro', value: 'book' },
  { label: 'Capítulo', value: 'book_chapter' },
  { label: 'Informe', value: 'technical_report' },
  { label: 'Software', value: 'software' },
  { label: 'Patente', value: 'patent' },
]

const { user, isAdmin } = useAuth()
const requestFetch = useRequestFetch() as typeof $fetch

const filters = reactive<{
  productTypes: ProductType[]
  owner?: string
  from?: string
  to?: string
}>({
  productTypes: [],
  owner: isAdmin.value ? undefined : user.value?._id,
  from: undefined,
  to: undefined,
})

watch(
  () => user.value?._id,
  (nextUserId) => {
    if (!isAdmin.value) {
      filters.owner = nextUserId
    }
  },
)

const dashboardKey = computed(() =>
  [
    'dashboard-summary',
    user.value?._id ?? 'anonymous',
    filters.productTypes.slice().sort().join('|') || 'all',
    filters.from ?? 'none',
    filters.to ?? 'none',
  ].join(':'),
)

const {
  data: dashboard,
  status,
  refresh: refreshDashboard,
} = await useAsyncData(
  () => dashboardKey.value,
  () =>
    requestFetch<ApiSuccessResponse<ProductDashboardSummary>>('/api/dashboard', {
      query: {
        productType: filters.productTypes.length > 0 ? filters.productTypes : undefined,
        owner: filters.owner || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      },
    }),
  {
    watch: [
      () => user.value?._id,
      () => filters.productTypes.join('|'),
      () => filters.from,
      () => filters.to,
    ],
  },
)

const loading = computed(() => status.value === 'pending')

const summary = computed(() => dashboard.value?.data)
const overallTotal = computed(() => summary.value?.totalConfirmedProducts ?? 0)
const ownerTotal = computed(() => summary.value?.totalOwners ?? 0)
const totalTypes = computed(() => summary.value?.byType?.length ?? 0)
const totalYears = computed(() => summary.value?.byYear?.length ?? 0)

const removeTypeFilter = (productType: ProductType) => {
  filters.productTypes = filters.productTypes.filter((candidate) => candidate !== productType)
}

const clearDateFilter = (key: 'from' | 'to') => {
  filters[key] = undefined
}

const activeFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string; onRemove: () => void }> = []

  for (const selectedType of filters.productTypes) {
    const label = productTypeOptions.find((option) => option.value === selectedType)?.label
    if (!label) {
      continue
    }

    chips.push({
      key: `type-${selectedType}`,
      label: 'Tipo',
      value: label,
      onRemove: () => removeTypeFilter(selectedType),
    })
  }

  if (filters.from) {
    chips.push({
      key: 'from',
      label: 'Desde',
      value: filters.from,
      onRemove: () => clearDateFilter('from'),
    })
  }

  if (filters.to) {
    chips.push({
      key: 'to',
      label: 'Hasta',
      value: filters.to,
      onRemove: () => clearDateFilter('to'),
    })
  }

  return chips
})

const clearAllFilters = () => {
  filters.productTypes = []
  filters.owner = isAdmin.value ? undefined : user.value?._id
  filters.from = undefined
  filters.to = undefined
}

onMounted(() => {
  if (status.value === 'error') {
    void refreshDashboard()
  }
})
</script>

<template>
  <div class="dashboard-page space-y-5">
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:gap-6">
      <section class="min-w-0 space-y-5 xl:col-span-8">
        <div class="page-stage-primary">
          <DashboardQualityAlerts />
        </div>

        <div
          class="page-stage-grid page-stage-grid--tight grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
        >
          <UCard class="interactive-card" :ui="{ body: 'p-5' }">
            <div
              class="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-soft"
            >
              <span class="rounded-md bg-sipac-50 p-1.5 text-sipac-700">
                <UIcon name="i-lucide-file-text" class="size-3.5" />
              </span>
              Documentos
            </div>
            <div class="font-display text-3xl font-medium tabular-nums leading-none text-text">
              {{ loading ? '\u2014' : overallTotal }}
            </div>
            <p class="mt-2 text-xs text-text-soft">Confirmados en repositorio</p>
          </UCard>

          <UCard class="interactive-card" :ui="{ body: 'p-5' }">
            <div
              class="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-soft"
            >
              <span class="rounded-md bg-earth-100/80 p-1.5 text-earth-700">
                <UIcon name="i-lucide-users" class="size-3.5" />
              </span>
              Autores
            </div>
            <div class="font-display text-3xl font-medium tabular-nums leading-none text-text">
              {{ loading ? '\u2014' : ownerTotal }}
            </div>
            <p class="mt-2 text-xs text-text-soft">Con producción activa</p>
          </UCard>

          <UCard class="interactive-card" :ui="{ body: 'p-5' }">
            <div
              class="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-soft"
            >
              <span class="rounded-md bg-sipac-50 p-1.5 text-sipac-700">
                <UIcon name="i-lucide-layers" class="size-3.5" />
              </span>
              Tipos
            </div>
            <div class="font-display text-3xl font-medium tabular-nums leading-none text-text">
              {{ loading ? '\u2014' : totalTypes }}
            </div>
            <p class="mt-2 text-xs text-text-soft">Categorías distintas</p>
          </UCard>

          <UCard class="interactive-card" :ui="{ body: 'p-5' }">
            <div
              class="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-soft"
            >
              <span class="rounded-md bg-sipac-50/80 p-1.5 text-earth-700">
                <UIcon name="i-lucide-calendar" class="size-3.5" />
              </span>
              Años
            </div>
            <div class="font-display text-3xl font-medium tabular-nums leading-none text-text">
              {{ loading ? '\u2014' : totalYears }}
            </div>
            <p class="mt-2 text-xs text-text-soft">Con actividad registrada</p>
          </UCard>
        </div>

        <div
          class="page-stage-grid page-stage-grid--tight grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6"
        >
          <DashboardTypeChart :summary="summary ?? null" :loading="loading" />
          <DashboardYearChart :summary="summary ?? null" :loading="loading" />
        </div>

        <div class="page-stage-supporting">
          <DashboardInsights
            :product-types="filters.productTypes"
            :owner="filters.owner"
            :from="filters.from"
            :to="filters.to"
            :is-admin="isAdmin"
          />
        </div>
      </section>

      <aside class="page-stage-supporting min-w-0 xl:col-span-4">
        <div
          class="space-y-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1"
        >
          <section class="panel-surface overflow-hidden p-5 sm:p-6">
            <h3 class="mb-4 flex items-center gap-2 font-display text-sm font-medium text-text">
              <UIcon name="i-lucide-sliders-horizontal" class="size-4 text-text-soft" />
              Filtros del tablero
            </h3>

            <div class="space-y-4">
              <UFormField label="Tipo de documento" name="dashboard-product-type-filter">
                <USelectMenu
                  v-model="filters.productTypes"
                  :items="productTypeOptions"
                  value-key="value"
                  multiple
                  size="md"
                  class="w-full"
                  placeholder="Selecciona uno o varios tipos"
                  icon="i-lucide-filter"
                />
              </UFormField>

              <UFormField label="Rango histórico" name="dashboard-date-range-filter">
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <UInput
                    v-model="filters.from"
                    type="date"
                    size="sm"
                    class="w-full"
                    placeholder="Desde"
                  />
                  <UInput
                    v-model="filters.to"
                    type="date"
                    size="sm"
                    class="w-full"
                    placeholder="Hasta"
                  />
                </div>
              </UFormField>

              <div v-if="activeFilterChips.length" class="flex flex-wrap gap-2 pt-1">
                <UButton
                  v-for="chip in activeFilterChips"
                  :key="chip.key"
                  color="neutral"
                  variant="soft"
                  size="xs"
                  trailing-icon="i-lucide-x"
                  class="rounded-full"
                  @click="chip.onRemove()"
                >
                  {{ chip.label }}: {{ chip.value }}
                </UButton>
              </div>

              <div class="flex justify-end pt-2">
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  icon="i-lucide-rotate-ccw"
                  @click="clearAllFilters"
                >
                  Limpiar filtros
                </UButton>
              </div>
            </div>
          </section>

          <DashboardTelemetry :loading="loading" />
        </div>
      </aside>
    </div>
  </div>
</template>
