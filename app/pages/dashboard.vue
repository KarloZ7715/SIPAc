<script setup lang="ts">
import type { ApiSuccessResponse, ProductDashboardSummary, ProductType } from '~~/app/types'

const dashboard = ref<ProductDashboardSummary | null>(null)
const loading = ref(false)

const filters = reactive<{
  productType?: ProductType
  owner?: string
  from?: string
  to?: string
}>({
  productType: undefined,
  owner: undefined,
  from: undefined,
  to: undefined,
})

const productTypeOptions = [
  { label: 'Todos los tipos', value: undefined },
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

const ownerOptions = computed(() => [
  { label: 'Todos los usuarios', value: undefined },
  ...(dashboard.value?.byOwner.map((item) => ({
    label: `${item.ownerName} (${item.total})`,
    value: item.ownerId,
  })) ?? []),
])

const activeFilterChips = computed(() => {
  const chips: Array<{ label: string; value: string }> = []

  const productTypeLabel = productTypeOptions.find(
    (item) => item.value === filters.productType,
  )?.label
  if (productTypeLabel) {
    chips.push({ label: 'Tipo', value: productTypeLabel })
  }

  const ownerLabel = ownerOptions.value.find((item) => item.value === filters.owner)?.label
  if (ownerLabel) {
    chips.push({ label: 'Usuario', value: ownerLabel })
  }

  if (filters.from) {
    chips.push({ label: 'Desde', value: filters.from })
  }

  if (filters.to) {
    chips.push({ label: 'Hasta', value: filters.to })
  }

  return chips
})

async function loadDashboard() {
  loading.value = true
  try {
    const response = await $fetch<ApiSuccessResponse<ProductDashboardSummary>>('/api/dashboard', {
      query: {
        ...(filters.productType ? { productType: filters.productType } : {}),
        ...(filters.owner ? { owner: filters.owner } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      },
    })

    dashboard.value = response.data
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.productType = undefined
  filters.owner = undefined
  filters.from = undefined
  filters.to = undefined
  void loadDashboard()
}

onMounted(() => {
  void loadDashboard()
})
</script>

<template>
  <div class="space-y-8">
    <ExperiencePageHero
      eyebrow="Lectura rápida"
      title="Entiende cómo va tu producción académica sin perder tiempo entre filtros."
      description="Aquí ves volumen, tipos de documento, periodos y autores con una lectura clara para decidir qué revisar o qué falta completar."
      icon="i-lucide-chart-column-big"
      compact
    >
      <template #actions>
        <SipacButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-rotate-ccw"
          :loading="loading"
          @click="resetFilters"
        >
          Limpiar
        </SipacButton>
        <SipacButton icon="i-lucide-filter" :loading="loading" @click="loadDashboard">
          Aplicar filtros
        </SipacButton>
      </template>

      <template #aside>
        <ExperienceContextPanel
          eyebrow="Lectura actual"
          title="Prioriza el periodo y el tipo que quieras revisar."
          description="Usa filtros cuando busques una vista puntual; si no, este panel te muestra la foto general de tu producción."
          icon="i-lucide-scan-search"
          tone="neutral"
        >
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div class="rounded-xl bg-white/78 p-3">
              <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
                Periodo
              </p>
              <p class="mt-1 text-sm font-semibold text-text">
                {{
                  dashboard?.dateRange?.from || dashboard?.dateRange?.to
                    ? `${dashboard?.dateRange?.from || 'Sin inicio'} - ${dashboard?.dateRange?.to || 'Sin cierre'}`
                    : 'Sin límite'
                }}
              </p>
            </div>
            <div class="rounded-xl bg-white/78 p-3">
              <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">Vista</p>
              <p class="mt-1 text-sm font-semibold text-text">
                {{ activeFilterChips.length ? 'Filtrada' : 'General' }}
              </p>
            </div>
          </div>
        </ExperienceContextPanel>
      </template>
    </ExperiencePageHero>

    <!-- Summary Cards -->
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <ExperienceStatCard
        label="Documentos"
        :value="dashboard?.totalConfirmedProducts ?? 0"
        icon="i-lucide-file-check"
        caption="guardados en total"
      />
      <ExperienceStatCard
        label="Autores"
        :value="dashboard?.totalOwners ?? 0"
        icon="i-lucide-users"
        tone="earth"
        caption="usuarios con producción"
      />
      <ExperienceStatCard
        label="Tipos"
        :value="dashboard?.byType.length ?? 0"
        icon="i-lucide-layers"
        caption="categorías diferentes"
      />
      <ExperienceStatCard
        label="Años"
        :value="dashboard?.byYear.length ?? 0"
        icon="i-lucide-calendar"
        tone="earth"
        caption="con producción registrada"
      />
    </section>

    <!-- Filters Section -->
    <section class="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <SipacCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-sliders-horizontal" class="size-4.5 text-sipac-600" />
            <div>
              <h2 class="font-semibold text-text">Filtros</h2>
              <p class="text-sm text-text-muted">Ajusta la vista según lo que necesites</p>
            </div>
          </div>
        </template>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <UFormField label="Tipo de documento">
            <USelect
              v-model="filters.productType"
              color="neutral"
              variant="outline"
              :items="productTypeOptions"
            />
          </UFormField>
          <UFormField label="Usuario">
            <USelect
              v-model="filters.owner"
              color="neutral"
              variant="outline"
              :items="ownerOptions"
            />
          </UFormField>
          <UFormField label="Desde">
            <UInput v-model="filters.from" color="neutral" variant="outline" type="date" />
          </UFormField>
          <UFormField label="Hasta">
            <UInput v-model="filters.to" color="neutral" variant="outline" type="date" />
          </UFormField>
        </div>

        <div v-if="activeFilterChips.length" class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="chip in activeFilterChips"
            :key="`${chip.label}-${chip.value}`"
            class="filter-chip"
          >
            <span class="font-medium">{{ chip.label }}:</span> {{ chip.value }}
          </span>
        </div>
      </SipacCard>

      <SipacCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-calendar-range" class="size-4.5 text-earth-600" />
            <div>
              <h2 class="font-semibold text-text">Periodo seleccionado</h2>
              <p class="text-sm text-text-muted">Rango de fechas actual</p>
            </div>
          </div>
        </template>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-border/60 bg-surface-muted/50 p-4">
            <p class="text-sm font-medium text-text">Desde</p>
            <p class="mt-1 text-lg font-semibold text-sipac-700">
              {{ dashboard?.dateRange?.from || 'Sin límite' }}
            </p>
          </div>
          <div class="rounded-xl border border-border/60 bg-surface-muted/50 p-4">
            <p class="text-sm font-medium text-text">Hasta</p>
            <p class="mt-1 text-lg font-semibold text-sipac-700">
              {{ dashboard?.dateRange?.to || 'Sin límite' }}
            </p>
          </div>
        </div>
      </SipacCard>
    </section>

    <!-- Charts Section -->
    <section class="grid gap-6 xl:grid-cols-3">
      <!-- By Type -->
      <SipacCard class="xl:col-span-1">
        <template #header>
          <div class="flex items-center gap-2">
            <span
              class="flex size-9 items-center justify-center rounded-xl bg-sipac-50 text-sipac-600"
            >
              <UIcon name="i-lucide-pie-chart" class="size-4.5" />
            </span>
            <div>
              <h2 class="font-semibold text-text">Por tipo</h2>
              <p class="text-sm text-text-muted">Distribución de documentos</p>
            </div>
          </div>
        </template>

        <div v-if="dashboard?.byType.length" class="space-y-3">
          <div
            v-for="item in dashboard.byType"
            :key="item.productType"
            class="rounded-xl border border-border/60 bg-surface-muted/30 p-4 space-y-2"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-text">{{ item.productType }}</p>
              <SipacBadge color="primary" variant="subtle">{{ item.total }}</SipacBadge>
            </div>
            <UProgress
              :model-value="
                dashboard.totalConfirmedProducts
                  ? Math.round((item.total / dashboard.totalConfirmedProducts) * 100)
                  : 0
              "
            />
          </div>
        </div>
        <ExperienceEmptyState
          v-else
          icon="i-lucide-pie-chart"
          title="Sin documentos"
          description="Prueba otro rango o cambia los filtros para volver a ver distribución."
          compact
        />
      </SipacCard>

      <!-- By Owner -->
      <SipacCard class="xl:col-span-1">
        <template #header>
          <div class="flex items-center gap-2">
            <span
              class="flex size-9 items-center justify-center rounded-xl bg-earth-50 text-earth-600"
            >
              <UIcon name="i-lucide-users" class="size-4.5" />
            </span>
            <div>
              <h2 class="font-semibold text-text">Por autor</h2>
              <p class="text-sm text-text-muted">Usuarios con más producción</p>
            </div>
          </div>
        </template>

        <div v-if="dashboard?.byOwner.length" class="space-y-3">
          <div
            v-for="item in dashboard.byOwner"
            :key="item.ownerId"
            class="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-muted/30 p-4"
          >
            <div class="min-w-0">
              <p class="truncate font-semibold text-text">{{ item.ownerName }}</p>
              <p class="truncate text-xs text-text-muted">{{ item.ownerId }}</p>
            </div>
            <SipacBadge color="neutral" variant="subtle">{{ item.total }}</SipacBadge>
          </div>
        </div>
        <ExperienceEmptyState
          v-else
          icon="i-lucide-users"
          title="Sin autores visibles"
          description="Todavía no hay resultados para esta combinación de filtros."
          compact
        />
      </SipacCard>

      <!-- By Year -->
      <SipacCard class="xl:col-span-1">
        <template #header>
          <div class="flex items-center gap-2">
            <span
              class="flex size-9 items-center justify-center rounded-xl bg-sipac-50 text-sipac-600"
            >
              <UIcon name="i-lucide-trending-up" class="size-4.5" />
            </span>
            <div>
              <h2 class="font-semibold text-text">Por año</h2>
              <p class="text-sm text-text-muted">Evolución temporal</p>
            </div>
          </div>
        </template>

        <div v-if="dashboard?.byYear.length" class="space-y-3">
          <div
            v-for="item in dashboard.byYear"
            :key="item.year"
            class="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-surface-muted/30 p-4"
          >
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-calendar" class="size-4 text-text-soft" />
              <p class="font-semibold text-text">{{ item.year }}</p>
            </div>
            <p class="text-xl font-semibold tabular-nums text-sipac-700">{{ item.total }}</p>
          </div>
        </div>
        <ExperienceEmptyState
          v-else
          icon="i-lucide-calendar-range"
          title="Sin datos por año"
          description="Cuando haya fechas disponibles, verás aquí la evolución temporal."
          compact
        />
      </SipacCard>
    </section>
  </div>
</template>
