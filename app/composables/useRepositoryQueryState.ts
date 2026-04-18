import type { Ref } from 'vue'
import type { ProductType } from '~~/app/types'
import type { RepositorySortBy } from '~~/app/stores/documents'

/**
 * Snapshot del formulario del repositorio. Reúne todos los filtros que
 * la URL puede transportar. Se mantiene plano para simplificar el
 * `watch` y la serialización a query params.
 */
export interface RepositoryFormState {
  searchQuery: Ref<string>
  selectedProductType: Ref<ProductType | undefined>
  selectedYear: Ref<string>
  selectedInstitution: Ref<string>
  filterTitle: Ref<string>
  filterAuthor: Ref<string>
  filterKeyword: Ref<string>
  filterDateFrom: Ref<string>
  filterDateTo: Ref<string>
  onlyMine: Ref<boolean>
  sortBy: Ref<RepositorySortBy>
  viewMode: Ref<RepositoryViewMode>
  currentPage: Ref<number>
  pageLimit: Ref<number>
}

export type RepositoryViewMode = 'cards' | 'list' | 'compact'

const VALID_VIEW_MODES: readonly RepositoryViewMode[] = ['cards', 'list', 'compact']
const VALID_SORT: readonly RepositorySortBy[] = ['date_desc', 'date_asc', 'title_asc', 'title_desc']
const VALID_LIMITS = [10, 20, 50, 100] as const

/**
 * Serializa el estado de filtros a un objeto `query` y lo escribe en
 * la URL con `router.replace` (evita ensuciar el historial).
 */
export function useRepositoryQueryState(
  state: RepositoryFormState,
  productTypeValues: ProductType[],
) {
  const route = useRoute()
  const router = useRouter()

  function serialize(): Record<string, string> {
    const query: Record<string, string> = {}
    const safe = (v: string) => v.trim()

    if (safe(state.searchQuery.value)) query.search = safe(state.searchQuery.value)
    if (state.selectedProductType.value) query.productType = state.selectedProductType.value
    if (safe(state.selectedYear.value)) query.year = safe(state.selectedYear.value)
    if (safe(state.selectedInstitution.value))
      query.institution = safe(state.selectedInstitution.value)
    if (safe(state.filterTitle.value)) query.title = safe(state.filterTitle.value)
    if (safe(state.filterAuthor.value)) query.author = safe(state.filterAuthor.value)
    if (safe(state.filterKeyword.value)) query.keyword = safe(state.filterKeyword.value)
    if (state.filterDateFrom.value) query.dateFrom = state.filterDateFrom.value
    if (state.filterDateTo.value) query.dateTo = state.filterDateTo.value
    if (state.onlyMine.value) query.mine = '1'
    if (state.sortBy.value !== 'date_desc') query.sortBy = state.sortBy.value
    if (state.pageLimit.value !== 10) query.limit = String(state.pageLimit.value)
    if (state.currentPage.value > 1) query.page = String(state.currentPage.value)
    if (state.viewMode.value !== 'list') query.view = state.viewMode.value

    return query
  }

  function syncToRoute() {
    const next = serialize()
    const current = route.query
    const sameKeys = Object.keys(next).length === Object.keys(current).length
    const sameValues = Object.entries(next).every(([key, value]) => current[key] === value)
    if (sameKeys && sameValues) return
    void router.replace({ query: next })
  }

  function hydrateFromRoute() {
    const q = route.query
    const readString = (key: string): string | undefined =>
      typeof q[key] === 'string' ? q[key] : undefined

    const search = readString('search')
    if (search) state.searchQuery.value = search

    const productType = readString('productType')
    if (productType && productTypeValues.includes(productType as ProductType)) {
      state.selectedProductType.value = productType as ProductType
    }

    const year = readString('year')
    if (year) state.selectedYear.value = year

    const institution = readString('institution')
    if (institution) state.selectedInstitution.value = institution

    const title = readString('title')
    if (title) state.filterTitle.value = title

    const author = readString('author')
    if (author) state.filterAuthor.value = author

    const keyword = readString('keyword')
    if (keyword) state.filterKeyword.value = keyword

    const dateFrom = readString('dateFrom')
    if (dateFrom) state.filterDateFrom.value = dateFrom

    const dateTo = readString('dateTo')
    if (dateTo) state.filterDateTo.value = dateTo

    if (readString('mine') === '1') state.onlyMine.value = true

    const sort = readString('sortBy')
    if (sort && VALID_SORT.includes(sort as RepositorySortBy)) {
      state.sortBy.value = sort as RepositorySortBy
    }

    const limit = readString('limit')
    if (limit) {
      const parsed = Number(limit)
      if (VALID_LIMITS.includes(parsed as (typeof VALID_LIMITS)[number])) {
        state.pageLimit.value = parsed
      }
    }

    const page = readString('page')
    if (page) {
      const parsed = Number(page)
      if (Number.isFinite(parsed) && parsed > 0) state.currentPage.value = parsed
    }

    const view = readString('view')
    if (view && VALID_VIEW_MODES.includes(view as RepositoryViewMode)) {
      state.viewMode.value = view as RepositoryViewMode
    }
  }

  return { syncToRoute, hydrateFromRoute, serialize }
}
