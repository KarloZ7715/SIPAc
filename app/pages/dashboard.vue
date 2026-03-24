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
    <section class="panel-surface hero-wash fade-up p-6 sm:p-8">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-4">
          <div class="section-chip">M5B · Analítica</div>
          <SipacSectionHeader
            title="Dashboard académico"
            description="Indicadores construidos sobre productos confirmados y no eliminados."
            size="md"
          />
        </div>

        <div class="flex flex-wrap gap-3">
          <SipacButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-ccw"
            :loading="loading"
            @click="resetFilters"
          >
            Limpiar filtros
          </SipacButton>
          <SipacButton icon="i-lucide-filter" :loading="loading" @click="loadDashboard">
            Aplicar filtros
          </SipacButton>
        </div>
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-4">
      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
            Total confirmado
          </p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-text">
          {{ dashboard?.totalConfirmedProducts ?? 0 }}
        </p>
      </SipacCard>

      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
            Autores/propietarios
          </p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-text">
          {{ dashboard?.totalOwners ?? 0 }}
        </p>
      </SipacCard>

      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
            Tipos visibles
          </p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-text">
          {{ dashboard?.byType.length ?? 0 }}
        </p>
      </SipacCard>

      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
            Años visibles
          </p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-text">
          {{ dashboard?.byYear.length ?? 0 }}
        </p>
      </SipacCard>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <SipacCard>
        <template #header>
          <SipacSectionHeader
            title="Filtros"
            description="Ajusta el conjunto sobre el que se calculan todos los indicadores."
            size="md"
          />
        </template>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <USelect
            v-model="filters.productType"
            color="neutral"
            variant="outline"
            :items="productTypeOptions"
          />
          <USelect
            v-model="filters.owner"
            color="neutral"
            variant="outline"
            :items="ownerOptions"
          />
          <UInput v-model="filters.from" color="neutral" variant="outline" type="date" />
          <UInput v-model="filters.to" color="neutral" variant="outline" type="date" />
        </div>
      </SipacCard>

      <SipacCard>
        <template #header>
          <SipacSectionHeader
            title="Rango aplicado"
            description="Ventana temporal utilizada por el backend si definiste fechas."
            size="md"
          />
        </template>

        <div class="space-y-3 text-sm">
          <div class="panel-muted p-4">
            <p class="font-semibold text-text">Desde</p>
            <p class="mt-1 text-text-muted">{{ dashboard?.dateRange?.from || 'Sin límite' }}</p>
          </div>
          <div class="panel-muted p-4">
            <p class="font-semibold text-text">Hasta</p>
            <p class="mt-1 text-text-muted">{{ dashboard?.dateRange?.to || 'Sin límite' }}</p>
          </div>
        </div>
      </SipacCard>
    </section>

    <section class="grid gap-6 xl:grid-cols-3">
      <SipacCard class="xl:col-span-1">
        <template #header>
          <SipacSectionHeader
            title="Por tipo"
            description="Distribución del repositorio confirmado."
            size="md"
          />
        </template>

        <div v-if="dashboard?.byType.length" class="space-y-3">
          <div
            v-for="item in dashboard.byType"
            :key="item.productType"
            class="panel-muted space-y-2 p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-text">{{ item.productType }}</p>
              <p class="text-sm font-semibold text-text">{{ item.total }}</p>
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
        <UEmpty
          v-else
          icon="i-lucide-chart-pie"
          title="Sin datos"
          description="No hay productos confirmados para la combinación actual de filtros."
        />
      </SipacCard>

      <SipacCard class="xl:col-span-1">
        <template #header>
          <SipacSectionHeader
            title="Por usuario"
            description="Top de propietarios según el conjunto filtrado."
            size="md"
          />
        </template>

        <div v-if="dashboard?.byOwner.length" class="space-y-3">
          <div
            v-for="item in dashboard.byOwner"
            :key="item.ownerId"
            class="panel-muted flex items-center justify-between gap-4 p-4"
          >
            <div>
              <p class="font-semibold text-text">{{ item.ownerName }}</p>
              <p class="text-sm text-text-muted">{{ item.ownerId }}</p>
            </div>
            <SipacBadge color="primary" variant="subtle">{{ item.total }}</SipacBadge>
          </div>
        </div>
        <UEmpty
          v-else
          icon="i-lucide-users-round"
          title="Sin propietarios visibles"
          description="Ajusta filtros o espera a que existan productos confirmados."
        />
      </SipacCard>

      <SipacCard class="xl:col-span-1">
        <template #header>
          <SipacSectionHeader
            title="Serie temporal"
            description="Publicaciones agrupadas por año."
            size="md"
          />
        </template>

        <div v-if="dashboard?.byYear.length" class="space-y-3">
          <div
            v-for="item in dashboard.byYear"
            :key="item.year"
            class="panel-muted flex items-center justify-between gap-4 p-4"
          >
            <p class="font-semibold text-text">{{ item.year }}</p>
            <p class="text-lg font-semibold tabular-nums text-text">{{ item.total }}</p>
          </div>
        </div>
        <UEmpty
          v-else
          icon="i-lucide-calendar-range"
          title="Sin serie temporal"
          description="No hay fechas confirmadas para el subconjunto actual."
        />
      </SipacCard>
    </section>
  </div>
</template>
