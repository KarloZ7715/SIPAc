import { toAcademicProductPublic } from '~~/server/utils/product'
import { ok } from '~~/server/utils/response'
import { PRODUCT_TYPES, type ProductType } from '~~/app/types'
import { searchConfirmedRepositoryProducts } from '~~/server/services/products/confirmed-repository-search'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const query = getQuery(event)
  const productType =
    typeof query.productType === 'string' &&
    PRODUCT_TYPES.includes(query.productType as ProductType)
      ? (query.productType as ProductType)
      : undefined

  const { products, total, page, limit, hasMore } = await searchConfirmedRepositoryProducts(
    {
      productType,
      year: typeof query.year === 'string' ? query.year : undefined,
      owner: typeof query.owner === 'string' ? query.owner : undefined,
      institution: typeof query.institution === 'string' ? query.institution : undefined,
      search: typeof query.search === 'string' ? query.search : undefined,
    },
    {
      page: typeof query.page === 'string' ? Number(query.page) : undefined,
      limit: typeof query.limit === 'string' ? Number(query.limit) : undefined,
    },
  )

  return ok(products.map(toAcademicProductPublic), {
    total,
    page,
    limit,
    hasMore,
  })
})
