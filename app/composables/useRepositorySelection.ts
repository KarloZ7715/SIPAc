import type { Ref } from 'vue'
import type { AcademicProductPublic } from '~~/app/types'

/**
 * Encapsula el estado y helpers de selección múltiple del repositorio.
 *
 * Diseño:
 * - Guarda IDs, no referencias, para ser robusto cuando la página cambia.
 * - Derivados `selectedProducts`, `selectedOwnProducts`, `hasSelectedOwn`
 *   para que los consumidores no repitan filtros de propiedad.
 */
export function useRepositorySelection(
  products: Ref<AcademicProductPublic[]>,
  isOwner: (product: AcademicProductPublic) => boolean,
) {
  const selectedProductIds = ref<string[]>([])

  const selectedProducts = computed(() =>
    products.value.filter((product) => selectedProductIds.value.includes(product._id)),
  )

  const selectedOwnProducts = computed(() =>
    selectedProducts.value.filter((product) => isOwner(product)),
  )

  const selectedNonOwnCount = computed(
    () => selectedProducts.value.length - selectedOwnProducts.value.length,
  )

  const hasSelectedOwn = computed(() => selectedOwnProducts.value.length > 0)

  const selectedAllOnPage = computed(
    () =>
      products.value.length > 0 &&
      products.value.every((product) => selectedProductIds.value.includes(product._id)),
  )

  function toggleSelectAllOnPage() {
    if (selectedAllOnPage.value) {
      selectedProductIds.value = selectedProductIds.value.filter(
        (id) => !products.value.some((product) => product._id === id),
      )
      return
    }

    const additions = products.value.map((product) => product._id)
    selectedProductIds.value = Array.from(new Set([...selectedProductIds.value, ...additions]))
  }

  function toggleProductSelection(productId: string) {
    if (selectedProductIds.value.includes(productId)) {
      selectedProductIds.value = selectedProductIds.value.filter((id) => id !== productId)
      return
    }
    selectedProductIds.value = [...selectedProductIds.value, productId]
  }

  function clear() {
    selectedProductIds.value = []
  }

  function pruneToCurrentPage() {
    selectedProductIds.value = selectedProductIds.value.filter((id) =>
      products.value.some((product) => product._id === id),
    )
  }

  return {
    selectedProductIds,
    selectedProducts,
    selectedOwnProducts,
    selectedNonOwnCount,
    hasSelectedOwn,
    selectedAllOnPage,
    toggleSelectAllOnPage,
    toggleProductSelection,
    clear,
    pruneToCurrentPage,
  }
}
