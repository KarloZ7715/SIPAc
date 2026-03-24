<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Repositorio de Productos Academicos</h1>
      <p class="mt-1 text-sm text-gray-500">
        Explora y gestiona todos los productos academicos del sistema
      </p>
    </div>

    <!-- Filters -->
    <UCard class="mb-6">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <!-- Search -->
        <div class="lg:col-span-2">
          <UInput
            v-model="searchQuery"
            placeholder="Buscar por titulo, autor, palabras clave..."
            icon="i-heroicons-magnifying-glass"
            :loading="documentsStore.repositoryLoading"
            @keydown.enter="applySearch"
          />
        </div>

        <!-- Product Type Filter -->
        <USelectMenu
          v-model="selectedProductType"
          :options="productTypeOptions"
          placeholder="Tipo de producto"
          value-attribute="value"
          option-attribute="label"
        />

        <!-- Year Filter -->
        <UInput
          v-model="selectedYear"
          placeholder="Ano (ej. 2026)"
          type="number"
          min="1900"
          :max="new Date().getFullYear() + 1"
        />

        <!-- Institution Filter -->
        <UInput v-model="selectedInstitution" placeholder="Institucion" />
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <UButton color="neutral" variant="soft" @click="clearFilters"> Limpiar filtros </UButton>
        <UButton color="primary" :loading="documentsStore.repositoryLoading" @click="applyFilters">
          Aplicar filtros
        </UButton>
      </div>
    </UCard>

    <!-- Results info -->
    <div class="mb-4 flex items-center justify-between">
      <p class="text-sm text-gray-600">
        <template v-if="documentsStore.repositoryMeta">
          Mostrando {{ documentsStore.repositoryProducts.length }} de
          {{ documentsStore.repositoryMeta.total }} resultados
        </template>
        <template v-else> Cargando... </template>
      </p>
    </div>

    <!-- Loading state -->
    <div
      v-if="documentsStore.repositoryLoading && !documentsStore.repositoryProducts.length"
      class="flex justify-center py-12"
    >
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-primary-500" />
    </div>

    <!-- Empty state -->
    <UCard v-else-if="!documentsStore.repositoryProducts.length" class="py-12 text-center">
      <UIcon name="i-heroicons-document-magnifying-glass" class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-4 text-lg font-medium text-gray-900">No se encontraron productos</h3>
      <p class="mt-2 text-sm text-gray-500">Intenta ajustar los filtros de busqueda</p>
    </UCard>

    <!-- Products Grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UCard
        v-for="product in documentsStore.repositoryProducts"
        :key="product._id"
        class="transition-shadow hover:shadow-lg"
      >
        <template #header>
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <UBadge :color="getProductTypeColor(product.productType)" variant="subtle" size="xs">
                {{ getProductTypeLabel(product.productType) }}
              </UBadge>
              <h3 class="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">
                {{
                  product.manualMetadata.title ||
                  product.extractedEntities.title?.value ||
                  'Sin titulo'
                }}
              </h3>
            </div>
            <UDropdown :items="getProductActions(product)">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-heroicons-ellipsis-vertical"
                size="xs"
              />
            </UDropdown>
          </div>
        </template>

        <div class="space-y-3">
          <!-- Authors -->
          <div v-if="getAuthors(product).length" class="flex items-start gap-2">
            <UIcon name="i-heroicons-users" class="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
            <p class="line-clamp-2 text-xs text-gray-600">
              {{ getAuthors(product).join(', ') }}
            </p>
          </div>

          <!-- Institution -->
          <div v-if="getInstitution(product)" class="flex items-start gap-2">
            <UIcon
              name="i-heroicons-building-library"
              class="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
            />
            <p class="line-clamp-1 text-xs text-gray-600">
              {{ getInstitution(product) }}
            </p>
          </div>

          <!-- Date -->
          <div v-if="getDate(product)" class="flex items-center gap-2">
            <UIcon name="i-heroicons-calendar" class="h-4 w-4 flex-shrink-0 text-gray-400" />
            <p class="text-xs text-gray-600">
              {{ getDate(product) }}
            </p>
          </div>

          <!-- Keywords -->
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

          <!-- Status -->
          <div class="flex items-center justify-between border-t border-gray-100 pt-2">
            <UBadge
              :color="product.reviewStatus === 'confirmed' ? 'success' : 'warning'"
              variant="subtle"
              size="xs"
            >
              {{ product.reviewStatus === 'confirmed' ? 'Confirmado' : 'Borrador' }}
            </UBadge>
            <p class="text-xs text-gray-400">
              {{ formatDate(product.createdAt) }}
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Pagination -->
    <div
      v-if="documentsStore.repositoryMeta && documentsStore.repositoryMeta.total > 0"
      class="mt-8 flex justify-center"
    >
      <UPagination
        v-model="currentPage"
        :page-count="documentsStore.repositoryMeta.limit"
        :total="documentsStore.repositoryMeta.total"
        :max="5"
      />
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal v-model="showDeleteModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Confirmar eliminacion</h3>
        </template>

        <p class="text-gray-600">
          Estas seguro de que deseas eliminar este producto academico?
          <strong>Esta accion no se puede deshacer.</strong>
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

// Filters state
const searchQuery = ref('')
const selectedProductType = ref<ProductType | undefined>(undefined)
const selectedYear = ref('')
const selectedInstitution = ref('')
const currentPage = ref(1)

// Delete state
const showDeleteModal = ref(false)
const productToDelete = ref<AcademicProductPublic | null>(null)
const deletingProduct = ref(false)

// Product type options for select
const productTypeOptions = computed(() => [
  { value: undefined, label: 'Todos los tipos' },
  { value: 'article', label: 'Articulo' },
  { value: 'conference_paper', label: 'Ponencia' },
  { value: 'thesis', label: 'Tesis' },
  { value: 'certificate', label: 'Certificado' },
  { value: 'research_project', label: 'Proyecto de investigacion' },
  { value: 'book', label: 'Libro' },
  { value: 'book_chapter', label: 'Capitulo de libro' },
  { value: 'technical_report', label: 'Informe tecnico' },
  { value: 'software', label: 'Software' },
  { value: 'patent', label: 'Patente' },
])

// Load products on mount
onMounted(async () => {
  await documentsStore.fetchProducts()
})

// Watch page changes
watch(currentPage, async (newPage) => {
  await documentsStore.fetchProducts({ page: newPage })
})

function applySearch() {
  currentPage.value = 1
  documentsStore.fetchProducts({
    search: searchQuery.value || undefined,
    page: 1,
  })
}

function applyFilters() {
  currentPage.value = 1
  documentsStore.fetchProducts({
    productType: selectedProductType.value,
    year: selectedYear.value || undefined,
    institution: selectedInstitution.value || undefined,
    search: searchQuery.value || undefined,
    page: 1,
  })
}

function clearFilters() {
  searchQuery.value = ''
  selectedProductType.value = undefined
  selectedYear.value = ''
  selectedInstitution.value = ''
  currentPage.value = 1
  documentsStore.resetRepositoryFilters()
  documentsStore.fetchProducts()
}

function getProductActions(product: AcademicProductPublic) {
  return [
    [
      {
        label: 'Ver detalles',
        icon: 'i-heroicons-eye',
        click: () => navigateTo(`/workspace-documents?productId=${product._id}`),
      },
    ],
    ...(isAdmin.value || user.value?._id === product.owner
      ? [
          [
            {
              label: 'Eliminar',
              icon: 'i-heroicons-trash',
              click: () => openDeleteModal(product),
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
      description: 'El producto academico ha sido eliminado correctamente',
      color: 'success',
    })
    showDeleteModal.value = false
    productToDelete.value = null
  } catch {
    toast.add({
      title: 'Error',
      description: 'No se pudo eliminar el producto academico',
      color: 'error',
    })
  } finally {
    deletingProduct.value = false
  }
}

function getProductTypeLabel(type: ProductType): string {
  const labels: Record<ProductType, string> = {
    article: 'Articulo',
    conference_paper: 'Ponencia',
    thesis: 'Tesis',
    certificate: 'Certificado',
    research_project: 'Proyecto',
    book: 'Libro',
    book_chapter: 'Capitulo',
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
