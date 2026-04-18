import { toAcademicProductPublic } from '~~/server/utils/product'
import { ok } from '~~/server/utils/response'
import { PRODUCT_TYPES, type ProductType } from '~~/app/types'
import {
  searchConfirmedRepositoryProducts,
  type RepositoryCatalogSortBy,
} from '~~/server/services/products/confirmed-repository-search'

function parseSortBy(value: unknown): RepositoryCatalogSortBy | undefined {
  if (
    value === 'date_asc' ||
    value === 'date_desc' ||
    value === 'title_asc' ||
    value === 'title_desc'
  ) {
    return value
  }
  return undefined
}

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const query = getQuery(event)
  const productType =
    typeof query.productType === 'string' &&
    PRODUCT_TYPES.includes(query.productType as ProductType)
      ? (query.productType as ProductType)
      : undefined

  const { products, total, page, limit, hasMore, facets, telemetry } =
    await searchConfirmedRepositoryProducts(
      {
        productType,
        year: typeof query.year === 'string' ? query.year : undefined,
        owner: typeof query.owner === 'string' ? query.owner : undefined,
        institution: typeof query.institution === 'string' ? query.institution : undefined,
        search: typeof query.search === 'string' ? query.search : undefined,
        title: typeof query.title === 'string' ? query.title : undefined,
        author: typeof query.author === 'string' ? query.author : undefined,
        keyword: typeof query.keyword === 'string' ? query.keyword : undefined,
        dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : undefined,
        dateTo: typeof query.dateTo === 'string' ? query.dateTo : undefined,
        program: typeof query.program === 'string' ? query.program : undefined,
        faculty: typeof query.faculty === 'string' ? query.faculty : undefined,
      },
      {
        page: typeof query.page === 'string' ? Number(query.page) : undefined,
        limit: typeof query.limit === 'string' ? Number(query.limit) : undefined,
        sortBy: parseSortBy(query.sortBy),
      },
    )

  return ok(products.map(toAcademicProductPublic), {
    total,
    page,
    limit,
    hasMore,
    facets,
    telemetry,
  })
})
