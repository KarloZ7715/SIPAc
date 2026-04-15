<template>
  <div class="space-y-6 sm:space-y-8">
    <section class="panel-surface hero-wash fade-up px-5 py-5 sm:px-6 sm:py-6">
      <p class="text-[0.68rem] font-semibold tracking-[0.18em] text-text-soft uppercase">
        Catálogo institucional
      </p>
      <h1
        class="mt-1 font-display text-2xl font-medium leading-[1.2] text-text sm:text-3xl sm:leading-[1.2]"
      >
        Repositorio de productos académicos
      </h1>
      <p class="mt-2 max-w-2xl text-base leading-[1.6] text-text-muted">
        Explora y gestiona los productos académicos del sistema con filtros claros y vista en
        tarjetas.
      </p>
    </section>

    <section class="panel-surface home-dock-shell fade-up stagger-2 px-4 py-5 sm:px-6 sm:py-6">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div class="lg:col-span-2">
          <UInput
            v-model="searchQuery"
            placeholder="Buscar por título, autor, palabras clave…"
            icon="i-lucide-search"
            :loading="documentsStore.repositoryLoading"
            class="w-full"
            @keydown.enter="applySearch"
          />
        </div>

        <USelectMenu
          v-model="selectedProductType"
          :items="productTypeOptions"
          placeholder="Tipo de producto"
          value-key="value"
          class="w-full min-w-0"
        />

        <UInput
          v-model="selectedYear"
          placeholder="Año (ej. 2026)"
          type="number"
          min="1900"
          :max="new Date().getFullYear() + 1"
          class="w-full"
        />

        <UInput v-model="selectedInstitution" placeholder="Institución" class="w-full" />
      </div>

      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="soft" @click="clearFilters">Limpiar filtros</UButton>
        <UButton color="primary" :loading="documentsStore.repositoryLoading" @click="applyFilters">
          Aplicar filtros
        </UButton>
      </div>
    </section>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-text-muted">
        <template v-if="documentsStore.repositoryMeta">
          Mostrando {{ documentsStore.repositoryProducts.length }} de
          {{ documentsStore.repositoryMeta.total }} resultados
        </template>
        <template v-else>Cargando…</template>
      </p>
    </div>

    <div
      v-if="documentsStore.repositoryLoading && !documentsStore.repositoryProducts.length"
      class="flex justify-center py-14"
    >
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-sipac-600" />
    </div>

    <div
      v-else-if="!documentsStore.repositoryProducts.length"
      class="panel-surface fade-up px-6 py-14 text-center"
    >
      <UIcon name="i-lucide-file-search" class="mx-auto size-12 text-text-soft" />
      <h3 class="mt-4 font-display text-xl font-medium text-text">No se encontraron productos</h3>
      <p class="mt-2 text-sm leading-[1.6] text-text-muted">
        Prueba a ajustar los filtros de búsqueda.
      </p>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UCard
        v-for="product in documentsStore.repositoryProducts"
        :key="product._id"
        class="interactive-card border-border/90 bg-surface/95 shadow-[var(--shadow-whisper)] ring-1 ring-border/85"
        :ui="{ root: 'rounded-[1.35rem] overflow-hidden', body: 'p-0' }"
      >
        <template #header>
          <div
            class="flex items-start justify-between gap-3 border-b border-border/50 bg-white/40 px-4 py-4"
          >
            <div class="min-w-0 flex-1">
              <UBadge :color="getProductTypeColor(product.productType)" variant="subtle" size="xs">
                {{ getProductTypeLabel(product.productType) }}
              </UBadge>
              <h3
                class="mt-2 line-clamp-2 font-display text-base font-medium leading-snug text-text"
              >
                {{
                  product.manualMetadata.title ||
                  product.extractedEntities.title?.value ||
                  'Sin título'
                }}
              </h3>
            </div>
            <UDropdownMenu :items="getProductActions(product)">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-ellipsis-vertical"
                size="xs"
              />
            </UDropdownMenu>
          </div>
        </template>

        <div class="space-y-3 px-4 pb-4 pt-3">
          <div v-if="getAuthors(product).length" class="flex items-start gap-2">
            <UIcon name="i-lucide-users" class="mt-0.5 size-4 shrink-0 text-text-soft" />
            <p class="line-clamp-2 text-xs leading-relaxed text-text-muted">
              {{ getAuthors(product).join(', ') }}
            </p>
          </div>

          <div v-if="getInstitution(product)" class="flex items-start gap-2">
            <UIcon name="i-lucide-building-2" class="mt-0.5 size-4 shrink-0 text-text-soft" />
            <p class="line-clamp-1 text-xs text-text-muted">
              {{ getInstitution(product) }}
            </p>
          </div>

          <div v-if="getDate(product)" class="flex items-center gap-2">
            <UIcon name="i-lucide-calendar" class="size-4 shrink-0 text-text-soft" />
            <p class="text-xs text-text-muted">
              {{ getDate(product) }}
            </p>
          </div>

          <div v-if="getKeywords(product).length" class="flex flex-wrap gap-1">
            <UBadge
              v-for="keyword in getKeywords(product).slice(0, 3)"
              :key="keyword"
              color="neutral"
              variant="outline"
              size="xs"
            >
              {{ keyword }}
            </UBadge>
            <UBadge
              v-if="getKeywords(product).length > 3"
              color="neutral"
              variant="outline"
              size="xs"
            >
              +{{ getKeywords(product).length - 3 }}
            </UBadge>
          </div>

          <div class="flex items-center justify-between border-t border-border/60 pt-3">
            <UBadge
              :color="product.reviewStatus === 'confirmed' ? 'success' : 'warning'"
              variant="subtle"
              size="xs"
            >
              {{ product.reviewStatus === 'confirmed' ? 'Confirmado' : 'Borrador' }}
            </UBadge>
            <p class="text-xs text-text-soft">
              {{ formatDate(product.createdAt) }}
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <div
      v-if="documentsStore.repositoryMeta && documentsStore.repositoryMeta.total > 0"
      class="flex justify-center pt-4"
    >
      <UPagination
        v-model="currentPage"
        :page-count="documentsStore.repositoryMeta.limit"
        :total="documentsStore.repositoryMeta.total"
        :max="5"
      />
    </div>

    <UModal v-model:open="showDeleteModal">
      <UCard
        class="panel-surface overflow-hidden border-0 shadow-[var(--shadow-whisper)] ring-1 ring-border/90"
        :ui="{ root: 'rounded-[1.25rem]' }"
      >
        <template #header>
          <h3 class="font-display text-lg font-medium text-text">Confirmar eliminación</h3>
        </template>

        <p class="text-sm leading-6 text-text-muted">
          ¿Seguro que deseas eliminar este producto académico?
          <strong class="text-text">Esta acción no se puede deshacer.</strong>
        </p>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="showDeleteModal = false">
              Cancelar
            </UButton>
            <UButton color="error" :loading="deletingProduct" @click="confirmDelete">
              Eliminar
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { AcademicProductPublic, ProductType } from '~~/app/types'

const documentsStore = useDocumentsStore()
const toast = useToast()
const { user, isAdmin } = useAuth()

const searchQuery = ref('')
const selectedProductType = ref<ProductType | undefined>(undefined)
const selectedYear = ref('')
const selectedInstitution = ref('')
const currentPage = ref(1)
const suppressPageWatcher = ref(false)

const showDeleteModal = ref(false)
const productToDelete = ref<AcademicProductPublic | null>(null)
const deletingProduct = ref(false)

const productTypeOptions = computed(() => [
  { value: undefined, label: 'Todos los tipos' },
  { value: 'article', label: 'Artículo' },
  { value: 'conference_paper', label: 'Ponencia' },
  { value: 'thesis', label: 'Tesis' },
  { value: 'certificate', label: 'Certificado' },
  { value: 'research_project', label: 'Proyecto de investigación' },
  { value: 'book', label: 'Libro' },
  { value: 'book_chapter', label: 'Capítulo de libro' },
  { value: 'technical_report', label: 'Informe técnico' },
  { value: 'software', label: 'Software' },
  { value: 'patent', label: 'Patente' },
])

onMounted(async () => {
  await documentsStore.fetchProducts()
})

watch(currentPage, async (newPage) => {
  if (suppressPageWatcher.value) {
    return
  }

  await documentsStore.fetchProducts({ page: newPage })
})

async function applySearch() {
  currentPage.value = 1
  suppressPageWatcher.value = true
  try {
    await documentsStore.fetchProducts({
      search: searchQuery.value || undefined,
      page: 1,
    })
  } finally {
    suppressPageWatcher.value = false
  }
}

async function applyFilters() {
  currentPage.value = 1
  suppressPageWatcher.value = true
  try {
    await documentsStore.fetchProducts({
      productType: selectedProductType.value,
      year: selectedYear.value || undefined,
      institution: selectedInstitution.value || undefined,
      search: searchQuery.value || undefined,
      page: 1,
    })
  } finally {
    suppressPageWatcher.value = false
  }
}

async function clearFilters() {
  searchQuery.value = ''
  selectedProductType.value = undefined
  selectedYear.value = ''
  selectedInstitution.value = ''
  currentPage.value = 1
  suppressPageWatcher.value = true
  try {
    documentsStore.resetRepositoryFilters()
    await documentsStore.fetchProducts()
  } finally {
    suppressPageWatcher.value = false
  }
}

function getProductActions(product: AcademicProductPublic) {
  return [
    [
      {
        label: 'Ver detalles',
        icon: 'i-lucide-eye',
        onSelect: () => navigateTo(`/workspace-documents?productId=${product._id}`),
      },
    ],
    ...(isAdmin.value || user.value?._id === product.owner
      ? [
          [
            {
              label: 'Eliminar',
              icon: 'i-lucide-trash-2',
              onSelect: () => openDeleteModal(product),
            },
          ],
        ]
      : []),
  ]
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

function getKeywords(product: AcademicProductPublic): string[] {
  return product.manualMetadata.keywords.length > 0
    ? product.manualMetadata.keywords
    : product.extractedEntities.keywords.map((k) => k.value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>
