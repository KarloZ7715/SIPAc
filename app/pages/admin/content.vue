<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type {
  ApiSuccessResponse,
  PaginationMeta,
  AcademicProductPublic,
  ProductType,
  ProductReviewStatus,
} from '~~/app/types'
import { PRODUCT_TYPES } from '~~/app/types'

definePageMeta({ middleware: ['admin'] })

type StatsResponse = ApiSuccessResponse<{
  total: number
  confirmed: number
  drafts: number
  deleted: number
  createdThisMonth: number
  confirmedThisMonth: number
  byType: Record<string, number>
}>

type ContentResponse = ApiSuccessResponse<{ products: AcademicProductPublic[] }>

const products = ref<AcademicProductPublic[]>([])
const stats = ref<StatsResponse['data'] | null>(null)
const meta = ref<PaginationMeta | null>(null)
const loading = ref(false)
const statsLoading = ref(false)

const filters = reactive<{
  page: number
  search: string
  type: ProductType | ''
  status: ProductReviewStatus | ''
}>({
  page: 1,
  search: '',
  type: '',
  status: '',
})

const typeOptions = [
  { label: 'Todos los tipos', value: '' },
  ...PRODUCT_TYPES.map((t) => ({ label: getProductTypeLabel(t), value: t })),
]

const statusOptions = [
  { label: 'Todos los estados', value: '' },
  { label: 'Confirmado', value: 'confirmed' },
  { label: 'Borrador', value: 'draft' },
]

function getProductTypeLabel(type: string): string {
  const map: Record<string, string> = {
    article: 'Artículo',
    conference_paper: 'Conferencia',
    thesis: 'Tesis',
    certificate: 'Certificado',
    research_project: 'Proyecto',
    book: 'Libro',
    book_chapter: 'Cap. Libro',
    technical_report: 'Reporte',
    software: 'Software',
    patent: 'Patente',
  }
  return map[type] || type
}

async function loadStats() {
  statsLoading.value = true
  try {
    const response = await $fetch<StatsResponse>('/api/admin/content/stats')
    stats.value = response.data
  } catch (err) {
    console.error('Error loading stats', err)
  } finally {
    statsLoading.value = false
  }
}

async function loadProducts() {
  loading.value = true
  try {
    const query: Record<string, string> = { page: String(filters.page) }
    if (filters.search) query.search = filters.search
    if (filters.type) query.type = filters.type
    if (filters.status) query.status = filters.status

    const response = await $fetch<ContentResponse>('/api/admin/content', { query })
    products.value = response.data.products
    meta.value = response.meta ?? null
  } catch (err) {
    console.error('Error loading products', err)
  } finally {
    loading.value = false
  }
}

await useAsyncData(
  'admin-content-bootstrap',
  async () => {
    await Promise.all([loadStats(), loadProducts()])
    return true
  },
  { default: () => true },
)

let searchTimeout: ReturnType<typeof setTimeout>
watch(
  () => filters.search,
  () => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      filters.page = 1
      void loadProducts()
    }, 400)
  },
)

watch([() => filters.type, () => filters.status], () => {
  filters.page = 1
  void loadProducts()
})

watch(
  () => filters.page,
  () => {
    void loadProducts()
  },
)

const columns = [
  {
    accessorKey: 'type',
    header: 'Tipo',
    cell: ({ row }: { row: { original: AcademicProductPublic } }) => {
      return h(resolveComponent('SipacBadge'), {
        variant: 'subtle',
        color: 'neutral',
        label: getProductTypeLabel(row.original.productType),
        size: 'sm',
      })
    },
  },
  {
    accessorKey: 'title',
    header: 'Título / Obra',
    cell: ({ row }: { row: { original: AcademicProductPublic } }) => {
      const p = row.original
      const title = p.manualMetadata?.title || p.extractedEntities?.title?.value || 'Sin título'
      return h('div', { class: 'max-w-xs truncate font-medium', title }, title)
    },
  },
  {
    accessorKey: 'owner',
    header: 'Propietario',
    cell: ({
      row,
    }: {
      row: { original: AcademicProductPublic & { owner?: { fullName?: string } } }
    }) => {
      return row.original.owner?.fullName || 'Desconocido'
    },
  },
  {
    accessorKey: 'status',
    header: 'Estado',
    cell: ({ row }: { row: { original: AcademicProductPublic } }) => {
      const s = row.original.reviewStatus
      return h(resolveComponent('SipacBadge'), {
        variant: 'outline',
        color: s === 'confirmed' ? 'success' : 'warning',
        label: s === 'confirmed' ? 'Confirmado' : 'Borrador',
        size: 'sm',
      })
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Fecha creación',
    cell: ({ row }: { row: { original: AcademicProductPublic } }) => {
      return new Date(row.original.createdAt).toLocaleDateString('es-CO')
    },
  },
]
</script>

<template>
  <div class="space-y-8">
    <section class="page-stage-hero panel-surface hero-wash p-6 sm:p-8">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-4">
          <div class="section-chip">Auditoría Institucional</div>
          <SipacSectionHeader
            title="Contenido Académico"
            description="Supervisión global de la producción académica de la institución."
            size="md"
          />
        </div>
      </div>
    </section>

    <!-- Global Stats -->
    <section class="page-stage-grid page-stage-grid--tight grid gap-4 lg:grid-cols-4">
      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">Total</p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-text">
          <UIcon
            v-if="statsLoading"
            name="i-lucide-loader-2"
            class="animate-spin text-text-muted"
          />
          <template v-else>{{ stats?.total ?? 0 }}</template>
        </p>
        <p class="mt-2 text-sm text-text-muted">Productos académicos indexados</p>
      </SipacCard>

      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
            Confirmados
          </p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-success-600">
          <UIcon v-if="statsLoading" name="i-lucide-loader-2" class="animate-spin" />
          <template v-else>{{ stats?.confirmed ?? 0 }}</template>
        </p>
        <p class="mt-2 text-sm text-text-muted">Producción validada</p>
      </SipacCard>

      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">Borradores</p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-warning-600">
          <UIcon v-if="statsLoading" name="i-lucide-loader-2" class="animate-spin" />
          <template v-else>{{ stats?.drafts ?? 0 }}</template>
        </p>
        <p class="mt-2 text-sm text-text-muted">Pendientes de revisión</p>
      </SipacCard>

      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">Mes actual</p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-text">
          <UIcon v-if="statsLoading" name="i-lucide-loader-2" class="animate-spin" />
          <template v-else>+{{ stats?.createdThisMonth ?? 0 }}</template>
        </p>
        <p class="mt-2 text-sm text-text-muted">{{ stats?.confirmedThisMonth ?? 0 }} confirmados</p>
      </SipacCard>
    </section>

    <SipacCard class="page-stage-primary">
      <template #header>
        <div class="grid gap-3 md:grid-cols-3">
          <UInput
            v-model="filters.search"
            icon="i-lucide-search"
            color="neutral"
            variant="outline"
            placeholder="Buscar por título..."
          />
          <USelect v-model="filters.type" color="neutral" variant="outline" :items="typeOptions" />
          <USelect
            v-model="filters.status"
            color="neutral"
            variant="outline"
            :items="statusOptions"
          />
        </div>
      </template>

      <UTable
        v-if="products.length || loading"
        :data="products"
        :columns="columns"
        :loading="loading"
        class="w-full text-sm"
      />

      <UEmpty
        v-else
        icon="i-lucide-file-text"
        title="Sin resultados"
        description="No se encontraron productos académicos con estos filtros."
      />

      <template #footer>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-text-muted">
            {{ meta?.total ?? products.length }} resultado{{
              (meta?.total ?? products.length) === 1 ? '' : 's'
            }}.
          </p>

          <UPagination
            v-if="meta"
            v-model:page="filters.page"
            :total="meta.total"
            :items-per-page="meta.limit"
            show-edges
            :sibling-count="1"
          />
        </div>
      </template>
    </SipacCard>
  </div>
</template>
