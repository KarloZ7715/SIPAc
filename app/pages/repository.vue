<template>
  <div class="repository-page space-y-5 sm:space-y-6 lg:space-y-8">
    <ExperiencePageHero
      eyebrow="Catálogo institucional"
      title="Catálogo del repositorio académico"
      description="Busca en el catálogo, ajusta la densidad de la vista, aplica filtros precisos y abre una vista previa sin salir. La edición en el workspace está reservada a tus propios registros."
      icon="i-lucide-library"
    >
      <template #badges>
        <SipacBadge v-if="totalResults !== null" color="neutral" variant="outline" size="lg">
          <UIcon name="i-lucide-hash" class="size-3.5" aria-hidden="true" />
          {{ totalResults }} registro{{ totalResults === 1 ? '' : 's' }} en el catálogo con los
          filtros actuales
        </SipacBadge>
      </template>

      <template #actions>
        <UButton
          to="/workspace-documents"
          color="primary"
          icon="i-lucide-file-plus-2"
          size="lg"
          class="rounded-xl"
        >
          Registrar o subir producto
        </UButton>
        <UButton
          to="/dashboard"
          color="neutral"
          variant="soft"
          icon="i-lucide-layout-dashboard"
          size="lg"
          class="rounded-xl"
        >
          Ver tablero analítico
        </UButton>
      </template>
    </ExperiencePageHero>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start xl:gap-6">
      <aside class="page-stage-supporting min-w-0 xl:col-span-4">
        <RepositoryFiltersPanel
          v-model:only-mine="onlyMine"
          v-model:product-type="selectedProductType"
          v-model:title="filterTitle"
          v-model:author="filterAuthor"
          v-model:keyword="filterKeyword"
          v-model:year="selectedYear"
          v-model:date-from="filterDateFrom"
          v-model:date-to="filterDateTo"
          v-model:institution="selectedInstitution"
          :product-type-options="productTypeOptions"
          :loading="documentsStore.repositoryLoading"
          :author-history="authorHistory"
          :institution-history="institutionHistory"
          :active-filter-chips="activeFilterChips"
          @apply="applyFilters"
          @clear="clearFilters"
        />
      </aside>

      <div class="min-w-0 space-y-4 xl:col-span-8">
        <section
          class="page-stage-primary panel-surface flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:gap-4 sm:p-5"
        >
          <UFormField
            label="Búsqueda en el catálogo"
            name="repository-search"
            class="min-w-0 flex-1"
          >
            <UInput
              ref="searchInputRef"
              v-model="searchQuery"
              placeholder="Título, autor, palabras clave…"
              icon="i-lucide-search"
              :loading="documentsStore.repositoryLoading"
              class="w-full"
              aria-keyshortcuts="/"
              @keydown.enter="applyFilters"
            />
          </UFormField>
          <UButton
            color="primary"
            class="shrink-0 rounded-xl"
            :loading="documentsStore.repositoryLoading"
            @click="applyFilters"
          >
            Buscar
          </UButton>
        </section>

        <div class="page-stage-inline">
          <RepositoryResultsToolbar
            v-model:view-mode="viewMode"
            v-model:sort-by="sortBy"
            v-model:page-limit="pageLimit"
            :view-mode-options="viewModeOptions"
            :sort-by-options="sortByOptions"
            :page-size-options="pageSizeOptions"
            @change-page-size="onPageSizeChange"
          />
        </div>

        <div class="page-stage-inline">
          <RepositorySavedSearches
            :saved-searches="savedSearches"
            :can-save="canSaveCurrentSearch"
            @save="onSaveCurrentSearch"
            @load="onLoadSavedSearch"
            @remove="removeSavedSearch"
          />
        </div>

        <div
          v-if="facetProductTypes.length"
          class="page-stage-supporting panel-surface flex flex-col gap-3 p-3 sm:p-4"
        >
          <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
            Facetas dinámicas
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-text-soft">Tipos</span>
            <UButton
              v-for="facet in facetProductTypes"
              :key="`ptype-${facet.value}`"
              color="neutral"
              variant="soft"
              size="xs"
              class="rounded-full"
              @click="applyFacetProductType(facet.value)"
            >
              {{ getProductTypeLabel(facet.value as ProductType) }} ({{ facet.count }})
            </UButton>
          </div>
        </div>

        <div
          class="page-stage-inline flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          aria-live="polite"
        >
          <p class="text-sm text-text-muted">
            <template v-if="documentsStore.repositoryMeta">
              Mostrando
              <span class="font-medium text-text">{{
                documentsStore.repositoryProducts.length
              }}</span>
              de
              <span class="font-medium text-text">{{ documentsStore.repositoryMeta.total }}</span>
              resultados
              <span v-if="documentsStore.repositoryMeta.total > 0" class="text-text-soft">
                · página {{ documentsStore.repositoryMeta.page ?? currentPage }} de
                {{ totalPages }}
              </span>
            </template>
            <template v-else>Cargando metadatos del catálogo…</template>
          </p>
          <p v-if="repoTelemetry" class="text-xs text-text-soft">
            Consulta en {{ repoTelemetry.executionMs }}ms · orden {{ telemetrySortLabel }}
          </p>
        </div>

        <div
          v-if="selectedProductIds.length"
          class="page-stage-supporting panel-surface flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:p-4"
          role="region"
          aria-label="Acciones en lote sobre documentos seleccionados"
        >
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              color="neutral"
              variant="soft"
              size="xs"
              :icon="selectedAllOnPage ? 'i-lucide-square' : 'i-lucide-check-square'"
              @click="toggleSelectAllOnPage"
            >
              {{ selectedAllOnPage ? 'Deseleccionar página' : 'Seleccionar página' }}
            </UButton>
            <span class="text-xs text-text-soft" aria-live="polite">
              <span class="font-medium text-text">{{ selectedProductIds.length }}</span>
              seleccionado{{ selectedProductIds.length === 1 ? '' : 's' }}
              <span v-if="selectedOwnProducts.length">
                ·
                <span class="font-medium text-text">{{ selectedOwnProducts.length }}</span>
                tuyo{{ selectedOwnProducts.length === 1 ? '' : 's' }}
              </span>
              <span v-if="selectedNonOwnCount" class="text-text-soft">
                · {{ selectedNonOwnCount }} de otros autores (no editables)
              </span>
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2 sm:justify-end">
            <UButton
              color="neutral"
              variant="soft"
              size="xs"
              icon="i-lucide-pencil-line"
              :disabled="!hasSelectedOwn"
              :title="
                hasSelectedOwn
                  ? 'Abrir en workspace el primer documento propio seleccionado'
                  : 'Selecciona al menos un documento tuyo para editarlo'
              "
              @click="openFirstOwnSelectionInWorkspace"
            >
              Editar primero propio
            </UButton>
            <UButton
              color="error"
              variant="soft"
              size="xs"
              icon="i-lucide-trash-2"
              :disabled="!hasSelectedOwn"
              :loading="deletingProduct"
              :title="
                hasSelectedOwn
                  ? 'Eliminar los documentos propios seleccionados'
                  : 'Selecciona al menos un documento tuyo para eliminarlo'
              "
              @click="deleteSelectedOwnProducts"
            >
              Eliminar seleccionados propios
            </UButton>
          </div>
        </div>

        <div
          v-if="documentsStore.repositoryLoading && !documentsStore.repositoryProducts.length"
          class="page-stage-primary space-y-3"
          aria-busy="true"
        >
          <USkeleton class="h-24 rounded-2xl" />
          <USkeleton class="h-24 rounded-2xl" />
          <USkeleton class="h-24 rounded-2xl" />
        </div>

        <div v-else-if="!documentsStore.repositoryProducts.length" class="page-stage-primary">
          <ExperienceEmptyState
            icon="i-lucide-file-search"
            title="No se encontraron productos"
            :description="emptyStateSuggestion"
          >
            <template #actions>
              <UButton color="neutral" variant="soft" @click="clearFilters">
                Restablecer criterios
              </UButton>
            </template>
          </ExperienceEmptyState>
        </div>

        <div v-else class="page-stage-primary">
          <RepositoryResultsList
            :products="documentsStore.repositoryProducts"
            :view-mode="viewMode"
            :selected-ids="selectedProductIds"
            :get-product-actions="getProductActions"
            :get-product-type-label="getProductTypeLabel"
            :get-product-type-color="getProductTypeColor"
            :get-product-title="getProductTitle"
            :get-authors="getAuthors"
            :get-institution="getInstitution"
            :get-date="getDate"
            :format-date="formatDate"
            :is-owner="isOwner"
            @preview="openPreview"
            @toggle-select="toggleProductSelection"
          />
        </div>

        <div
          v-if="documentsStore.repositoryMeta && documentsStore.repositoryMeta.total > 0"
          class="page-stage-inline flex flex-col items-stretch gap-4 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex flex-wrap items-center gap-2 text-xs text-text-soft">
            <span>{{ pageLimit }} ítems por página</span>
            <span class="hidden text-border sm:inline">·</span>
            <USelectMenu
              :model-value="pageLimit"
              :items="pageSizeOptions"
              value-key="value"
              size="xs"
              class="min-w-[5rem] sm:hidden"
              aria-label="Cambiar cantidad de ítems por página"
              @update:model-value="onPageSizeChange"
            />
          </div>
          <UPagination
            v-model:page="currentPage"
            :total="documentsStore.repositoryMeta.total"
            :items-per-page="documentsStore.repositoryMeta.limit"
            show-edges
            :sibling-count="1"
            class="justify-center sm:justify-end"
          />
        </div>
      </div>
    </div>

    <RepositoryPreviewSlideover
      v-model:open="previewOpen"
      :product="previewProduct"
      :get-product-title="getProductTitle"
      :get-product-type-label="getProductTypeLabel"
      :get-product-type-color="getProductTypeColor"
    />

    <UModal v-model:open="showDeleteModal" title="Confirmar eliminación">
      <template #body>
        <p class="text-sm leading-6 text-text-muted">
          ¿Seguro que deseas eliminar este producto académico?
          <strong class="text-text">Esta acción no se puede deshacer.</strong>
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="showDeleteModal = false">
            Cancelar
          </UButton>
          <UButton color="error" :loading="deletingProduct" @click="confirmDelete">
            Eliminar
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { AcademicProductPublic, ProductType } from '~~/app/types'
import type { RepositorySortBy } from '~~/app/stores/documents'
import type {
  RepositoryFormState,
  RepositoryViewMode,
} from '~~/app/composables/useRepositoryQueryState'
import type { SavedSearch } from '~~/app/composables/useRepositorySavedSearches'

useSeoMeta({
  title: 'Catálogo del repositorio',
  description:
    'Catálogo institucional de productos académicos confirmados: búsqueda, filtros avanzados y vista previa sin salir del flujo.',
})

const REPO_VIEW_KEY = 'sipac-repository-view-mode'
const REPO_VIEW_COOKIE_KEY = 'sipac_repository_view_mode'
const HISTORY_INST = 'sipac-repository-institution-hx'
const HISTORY_AUTH = 'sipac-repository-author-hx'
const HISTORY_MAX = 12
const SEARCH_DEBOUNCE_MS = 450
const DEFAULT_PAGE_SIZE = 10
const VALID_PAGE_SIZES = [10, 20, 50, 100]

const documentsStore = useDocumentsStore()
const toast = useToast()
const { user } = useAuth()
const route = useRoute()
const router = useRouter()
const requestFetch = import.meta.server ? useRequestFetch() : $fetch
const isRepositoryRouteActive = computed(() => route.path === '/repository')
const repositoryViewModeCookie = useCookie<string | undefined>(REPO_VIEW_COOKIE_KEY, {
  sameSite: 'lax',
  path: '/',
})

const searchQuery = ref('')
const selectedProductType = ref<ProductType | undefined>(undefined)
const selectedYear = ref('')
const selectedInstitution = ref('')
const filterTitle = ref('')
const filterAuthor = ref('')
const filterKeyword = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')
const onlyMine = ref(false)
const sortBy = ref<RepositorySortBy>('date_desc')
const viewMode = ref<RepositoryViewMode>('list')
const currentPage = ref(1)
const pageLimit = ref(DEFAULT_PAGE_SIZE)

const suppressPageWatcher = ref(false)
const isHydratingFromRoute = ref(false)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

function parseRepositoryViewMode(value: unknown): RepositoryViewMode | null {
  if (value === 'cards' || value === 'list' || value === 'compact') {
    return value
  }
  return null
}

const cookieViewMode = parseRepositoryViewMode(repositoryViewModeCookie.value)
if (cookieViewMode) {
  viewMode.value = cookieViewMode
}

const institutionHistory = ref<string[]>([])
const authorHistory = ref<string[]>([])

const previewOpen = ref(false)
const previewProduct = ref<AcademicProductPublic | null>(null)

const showDeleteModal = ref(false)
const productToDelete = ref<AcademicProductPublic | null>(null)
const deletingProduct = ref(false)

const viewModeOptions = [
  { value: 'cards' as const, label: 'Tarjetas', icon: 'i-lucide-layout-grid' },
  { value: 'list' as const, label: 'Lista', icon: 'i-lucide-list' },
  { value: 'compact' as const, label: 'Compacta', icon: 'i-lucide-minimize-2' },
]

const pageSizeOptions = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
]

const sortByOptions = [
  { value: 'date_desc' as const, label: 'Fecha (más reciente)' },
  { value: 'date_asc' as const, label: 'Fecha (más antigua)' },
  { value: 'title_asc' as const, label: 'Título (A → Z)' },
  { value: 'title_desc' as const, label: 'Título (Z → A)' },
]

const productTypeOptions = computed(() => [
  { value: undefined, label: 'Todos los tipos' },
  { value: 'article' as const, label: 'Artículo' },
  { value: 'conference_paper' as const, label: 'Ponencia' },
  { value: 'thesis' as const, label: 'Tesis' },
  { value: 'certificate' as const, label: 'Certificado' },
  { value: 'research_project' as const, label: 'Proyecto de investigación' },
  { value: 'book' as const, label: 'Libro' },
  { value: 'book_chapter' as const, label: 'Capítulo de libro' },
  { value: 'technical_report' as const, label: 'Informe técnico' },
  { value: 'software' as const, label: 'Software' },
  { value: 'patent' as const, label: 'Patente' },
])

const productTypeValues = computed(() =>
  productTypeOptions.value
    .map((opt) => opt.value)
    .filter((value): value is ProductType => Boolean(value)),
)

const formState: RepositoryFormState = {
  searchQuery,
  selectedProductType,
  selectedYear,
  selectedInstitution,
  filterTitle,
  filterAuthor,
  filterKeyword,
  filterDateFrom,
  filterDateTo,
  onlyMine,
  sortBy,
  viewMode,
  currentPage,
  pageLimit,
}

const { syncToRoute, hydrateFromRoute, serialize } = useRepositoryQueryState(
  formState,
  productTypeValues.value,
)

const products = computed<AcademicProductPublic[]>(() => documentsStore.repositoryProducts)

function isOwner(product: AcademicProductPublic): boolean {
  return Boolean(user.value?._id && user.value._id === product.owner)
}

const {
  selectedProductIds,
  selectedOwnProducts,
  selectedNonOwnCount,
  hasSelectedOwn,
  selectedAllOnPage,
  toggleSelectAllOnPage,
  toggleProductSelection,
  clear: clearSelection,
  pruneToCurrentPage,
} = useRepositorySelection(products, isOwner)

const {
  savedSearches,
  save: persistSavedSearch,
  remove: removeSavedSearch,
} = useRepositorySavedSearches()

const totalResults = computed(() => documentsStore.repositoryMeta?.total ?? null)

const totalPages = computed(() => {
  const meta = documentsStore.repositoryMeta
  if (!meta?.total || !meta.limit) return 1
  return Math.max(1, Math.ceil(meta.total / meta.limit))
})

const repoFacets = computed(() => documentsStore.repositoryMeta?.facets)
const facetProductTypes = computed(() => repoFacets.value?.productTypes ?? [])
const repoTelemetry = computed(() => documentsStore.repositoryMeta?.telemetry)
const telemetrySortLabel = computed(() => {
  const value = repoTelemetry.value?.sortBy
  if (value === 'date_asc') return 'fecha asc'
  if (value === 'title_asc') return 'título asc'
  if (value === 'title_desc') return 'título desc'
  return 'fecha desc'
})

const canSaveCurrentSearch = computed(() => Object.keys(serialize()).length > 0)

function hasActiveFilters(): boolean {
  return (
    Boolean(
      searchQuery.value.trim() ||
      filterTitle.value.trim() ||
      filterAuthor.value.trim() ||
      filterKeyword.value.trim() ||
      selectedYear.value.trim() ||
      filterDateFrom.value ||
      filterDateTo.value ||
      selectedInstitution.value.trim(),
    ) ||
    Boolean(selectedProductType.value) ||
    onlyMine.value
  )
}

const emptyStateSuggestion = computed(() => {
  if (onlyMine.value) {
    return 'No tienes productos que coincidan con estos filtros. Desactiva "Solo mis aportes" o ajusta algún criterio.'
  }
  if (selectedProductType.value) {
    return `No hay productos de tipo "${getProductTypeLabel(
      selectedProductType.value,
    )}" con estos criterios. Prueba quitando el filtro de tipo o amplía el rango de fechas.`
  }
  if (hasActiveFilters()) {
    return 'Ajusta los criterios del panel lateral o limpia filtros para volver a explorar el catálogo.'
  }
  return 'Aún no hay productos confirmados en el catálogo. Registra el primero desde el workspace.'
})

function loadJsonList(key: string): string[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveJsonList(key: string, values: string[]) {
  if (!import.meta.client) return
  localStorage.setItem(key, JSON.stringify(values.slice(0, HISTORY_MAX)))
}

function pushUniqueHistory(key: string, value: string, target: Ref<string[]>) {
  const trimmed = value.trim()
  if (!trimmed) return
  const next = [trimmed, ...target.value.filter((v) => v !== trimmed)].slice(0, HISTORY_MAX)
  target.value = next
  saveJsonList(key, next)
}

function persistViewMode(mode: RepositoryViewMode) {
  repositoryViewModeCookie.value = mode
  if (!import.meta.client) return

  localStorage.setItem(REPO_VIEW_KEY, mode)
}

function syncViewModeFromStorage() {
  if (!import.meta.client) {
    return
  }

  const parsed = parseRepositoryViewMode(localStorage.getItem(REPO_VIEW_KEY))
  if (!parsed) {
    return
  }

  viewMode.value = parsed
  repositoryViewModeCookie.value = parsed
}

function openPreview(product: AcademicProductPublic) {
  previewProduct.value = product
  previewOpen.value = true
}

function resolvePageSizeValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object' && 'value' in value) {
    const inner = (value as { value: unknown }).value
    if (typeof inner === 'number' && Number.isFinite(inner)) return inner
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function onPageSizeChange(value: unknown) {
  const limit = resolvePageSizeValue(value)
  if (limit === null || !VALID_PAGE_SIZES.includes(limit)) return

  suppressPageWatcher.value = true
  pageLimit.value = limit
  currentPage.value = 1
  try {
    await documentsStore.fetchProducts({ limit, page: 1 })
  } finally {
    suppressPageWatcher.value = false
  }
  syncToRoute()
}

function syncFormFromStore() {
  const rf = documentsStore.repositoryFilters
  searchQuery.value = rf.search ?? ''
  selectedProductType.value = rf.productType
  selectedYear.value = rf.year ?? ''
  selectedInstitution.value = rf.institution ?? ''
  filterTitle.value = rf.title ?? ''
  filterAuthor.value = rf.author ?? ''
  filterKeyword.value = rf.keyword ?? ''
  filterDateFrom.value = rf.dateFrom ?? ''
  filterDateTo.value = rf.dateTo ?? ''
  sortBy.value = rf.sortBy ?? 'date_desc'
  pageLimit.value = rf.limit ?? DEFAULT_PAGE_SIZE
  onlyMine.value = Boolean(rf.owner && user.value?._id && rf.owner === user.value._id)
  currentPage.value = rf.page ?? 1
}

syncFormFromStore()
hydrateFromRoute()
syncViewModeFromStorage()

await useAsyncData(
  'repository-bootstrap',
  async () => {
    await documentsStore.fetchProducts(buildStoreFilters(), requestFetch)
    return true
  },
  {
    default: () => true,
  },
)

onMounted(() => {
  if (import.meta.client) {
    institutionHistory.value = loadJsonList(HISTORY_INST)
    authorHistory.value = loadJsonList(HISTORY_AUTH)
  }
})

watch(
  () => route.fullPath,
  async () => {
    if (!isRepositoryRouteActive.value) return
    if (isHydratingFromRoute.value || suppressPageWatcher.value) return
    const serialized = serialize()
    const sameKeys = Object.keys(serialized).length === Object.keys(route.query).length
    const sameValues = Object.entries(serialized).every(
      ([key, value]) => route.query[key] === value,
    )
    if (sameKeys && sameValues) return

    isHydratingFromRoute.value = true
    suppressPageWatcher.value = true
    try {
      clearFormState()
      hydrateFromRoute()
      await documentsStore.fetchProducts(buildStoreFilters())
      clearSelection()
    } finally {
      suppressPageWatcher.value = false
      isHydratingFromRoute.value = false
    }
  },
)

watch(viewMode, (mode) => {
  persistViewMode(mode)
  if (isHydratingFromRoute.value) return
  syncToRoute()
})

watch(currentPage, async (newPage) => {
  if (suppressPageWatcher.value) return

  await documentsStore.fetchProducts({ page: newPage })
  pruneToCurrentPage()
  syncToRoute()
})

watch([sortBy, selectedProductType], async () => {
  if (suppressPageWatcher.value || isHydratingFromRoute.value) return
  await applyFilters()
})

watch(onlyMine, async () => {
  if (suppressPageWatcher.value || isHydratingFromRoute.value) return
  await applyFilters()
})

watch(
  () => [
    searchQuery.value,
    filterAuthor.value,
    filterKeyword.value,
    filterTitle.value,
    selectedInstitution.value,
  ],
  () => {
    if (isHydratingFromRoute.value || suppressPageWatcher.value) return
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      void applyFilters()
    }, SEARCH_DEBOUNCE_MS)
  },
)

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
})

function buildStoreFilters() {
  return {
    productType: selectedProductType.value,
    year: selectedYear.value || undefined,
    institution: selectedInstitution.value || undefined,
    search: searchQuery.value || undefined,
    title: filterTitle.value || undefined,
    author: filterAuthor.value || undefined,
    keyword: filterKeyword.value || undefined,
    dateFrom: filterDateFrom.value || undefined,
    dateTo: filterDateTo.value || undefined,
    sortBy: sortBy.value,
    owner: onlyMine.value && user.value?._id ? user.value._id : undefined,
    limit: pageLimit.value,
    page: currentPage.value,
  }
}

async function applyFilters() {
  pushUniqueHistory(HISTORY_INST, selectedInstitution.value, institutionHistory)
  pushUniqueHistory(HISTORY_AUTH, filterAuthor.value, authorHistory)

  currentPage.value = 1
  suppressPageWatcher.value = true
  try {
    await documentsStore.fetchProducts({
      ...buildStoreFilters(),
      page: 1,
    })
    clearSelection()
  } finally {
    suppressPageWatcher.value = false
  }
  syncToRoute()
}

const activeFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string; onRemove: () => void }> = []

  if (onlyMine.value) {
    chips.push({
      key: 'mine',
      label: 'Ámbito',
      value: 'Solo mis aportes',
      onRemove: () => {
        onlyMine.value = false
      },
    })
  }

  if (selectedProductType.value) {
    chips.push({
      key: 'type',
      label: 'Tipo',
      value: getProductTypeLabel(selectedProductType.value),
      onRemove: () => {
        selectedProductType.value = undefined
      },
    })
  }

  const textChips: Array<{ key: string; label: string; target: Ref<string> }> = [
    { key: 'title', label: 'Título', target: filterTitle },
    { key: 'author', label: 'Autor', target: filterAuthor },
    { key: 'keyword', label: 'Palabra clave', target: filterKeyword },
    { key: 'year', label: 'Año', target: selectedYear },
    { key: 'institution', label: 'Institución', target: selectedInstitution },
    { key: 'search', label: 'Búsqueda', target: searchQuery },
  ]

  for (const { key, label, target } of textChips) {
    const value = target.value.trim()
    if (!value) continue
    chips.push({
      key,
      label,
      value,
      onRemove: () => {
        target.value = ''
      },
    })
  }

  if (filterDateFrom.value) {
    chips.push({
      key: 'dateFrom',
      label: 'Desde',
      value: filterDateFrom.value,
      onRemove: () => {
        filterDateFrom.value = ''
      },
    })
  }

  if (filterDateTo.value) {
    chips.push({
      key: 'dateTo',
      label: 'Hasta',
      value: filterDateTo.value,
      onRemove: () => {
        filterDateTo.value = ''
      },
    })
  }

  return chips
})

async function clearFilters() {
  searchQuery.value = ''
  selectedProductType.value = undefined
  selectedYear.value = ''
  selectedInstitution.value = ''
  filterTitle.value = ''
  filterAuthor.value = ''
  filterKeyword.value = ''
  filterDateFrom.value = ''
  filterDateTo.value = ''
  sortBy.value = 'date_desc'
  onlyMine.value = false
  currentPage.value = 1
  pageLimit.value = DEFAULT_PAGE_SIZE

  suppressPageWatcher.value = true
  try {
    documentsStore.resetRepositoryFilters()
    await documentsStore.fetchProducts()
    clearSelection()
  } finally {
    suppressPageWatcher.value = false
  }
  syncToRoute()
}

function getProductActions(product: AcademicProductPublic): DropdownMenuItem[][] {
  const rows: DropdownMenuItem[][] = [
    [
      {
        label: 'Vista previa',
        icon: 'i-lucide-eye',
        onSelect: () => openPreview(product),
      },
    ],
  ]

  if (isOwner(product)) {
    rows.push([
      {
        label: 'Editar en workspace',
        icon: 'i-lucide-pencil-line',
        onSelect: () => navigateTo(`/workspace-documents?productId=${product._id}`),
      },
      {
        label: 'Eliminar',
        icon: 'i-lucide-trash-2',
        onSelect: () => openDeleteModal(product),
      },
    ])
  }

  return rows
}

function openFirstOwnSelectionInWorkspace() {
  const first = selectedOwnProducts.value[0]
  if (!first) return
  void navigateTo(`/workspace-documents?productId=${first._id}`)
}

async function deleteSelectedOwnProducts() {
  if (!hasSelectedOwn.value) return

  deletingProduct.value = true
  try {
    const ownIds = selectedOwnProducts.value.map((product) => product._id)
    await Promise.all(ownIds.map((id) => documentsStore.deleteProduct(id)))
    selectedProductIds.value = selectedProductIds.value.filter((id) => !ownIds.includes(id))
    toast.add({
      title: 'Productos eliminados',
      description: `${ownIds.length} producto${ownIds.length === 1 ? '' : 's'} eliminado${
        ownIds.length === 1 ? '' : 's'
      }.`,
      color: 'success',
    })
    await documentsStore.fetchProducts({ page: currentPage.value })
    syncToRoute()
  } catch {
    toast.add({
      title: 'Error',
      description: 'No se pudieron eliminar todos los productos seleccionados.',
      color: 'error',
    })
  } finally {
    deletingProduct.value = false
  }
}

function applyFacetProductType(value: string) {
  if (!value) return
  selectedProductType.value = value as ProductType
}

function onSaveCurrentSearch(name: string) {
  const saved = persistSavedSearch(name, serialize())
  if (!saved) return
  toast.add({
    title: 'Búsqueda guardada',
    description: `"${saved.name}" quedó en tus búsquedas frecuentes.`,
    color: 'success',
  })
}

async function onLoadSavedSearch(search: SavedSearch) {
  await router.replace({ query: { ...search.query } })

  isHydratingFromRoute.value = true
  suppressPageWatcher.value = true
  try {
    clearFormState()
    hydrateFromRoute()
    currentPage.value = Number(search.query.page) > 0 ? Number(search.query.page) : 1
    await documentsStore.fetchProducts(buildStoreFilters())
    clearSelection()
  } finally {
    suppressPageWatcher.value = false
    isHydratingFromRoute.value = false
  }

  toast.add({
    title: 'Búsqueda cargada',
    description: `Se aplicaron los filtros de "${search.name}".`,
    color: 'success',
  })
}

function clearFormState() {
  searchQuery.value = ''
  selectedProductType.value = undefined
  selectedYear.value = ''
  selectedInstitution.value = ''
  filterTitle.value = ''
  filterAuthor.value = ''
  filterKeyword.value = ''
  filterDateFrom.value = ''
  filterDateTo.value = ''
  sortBy.value = 'date_desc'
  onlyMine.value = false
  pageLimit.value = DEFAULT_PAGE_SIZE
  viewMode.value = 'list'
}

function openDeleteModal(product: AcademicProductPublic) {
  productToDelete.value = product
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!productToDelete.value) return

  deletingProduct.value = true
  try {
    await documentsStore.deleteProduct(productToDelete.value._id)
    toast.add({
      title: 'Producto eliminado',
      description: 'El producto académico se eliminó correctamente.',
      color: 'success',
    })
    showDeleteModal.value = false
    productToDelete.value = null
  } catch {
    toast.add({
      title: 'Error',
      description: 'No se pudo eliminar el producto académico.',
      color: 'error',
    })
  } finally {
    deletingProduct.value = false
  }
}

function getProductTypeLabel(type: ProductType): string {
  const labels: Record<ProductType, string> = {
    article: 'Artículo',
    conference_paper: 'Ponencia',
    thesis: 'Tesis',
    certificate: 'Certificado',
    research_project: 'Proyecto',
    book: 'Libro',
    book_chapter: 'Capítulo',
    technical_report: 'Informe',
    software: 'Software',
    patent: 'Patente',
  }
  return labels[type] || type
}

function getProductTypeColor(
  type: ProductType,
): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' {
  const colors: Record<ProductType, 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
    article: 'primary',
    conference_paper: 'info',
    thesis: 'success',
    certificate: 'warning',
    research_project: 'error',
    book: 'primary',
    book_chapter: 'info',
    technical_report: 'success',
    software: 'error',
    patent: 'warning',
  }
  return colors[type] || 'neutral'
}

function getProductTitle(product: AcademicProductPublic): string {
  return product.manualMetadata.title || product.extractedEntities.title?.value || 'Sin título'
}

function getAuthors(product: AcademicProductPublic): string[] {
  return product.manualMetadata.authors.length > 0
    ? product.manualMetadata.authors
    : product.extractedEntities.authors.map((a) => a.value)
}

function getInstitution(product: AcademicProductPublic): string | undefined {
  return product.manualMetadata.institution || product.extractedEntities.institution?.value
}

function getDate(product: AcademicProductPublic): string | undefined {
  const dateStr = product.manualMetadata.date || product.extractedEntities.date?.value
  if (!dateStr) return undefined
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>
