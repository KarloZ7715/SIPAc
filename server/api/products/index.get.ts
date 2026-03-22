import AcademicProduct from '~~/server/models/AcademicProduct'
import { toAcademicProductPublic } from '~~/server/utils/product'
import { ok } from '~~/server/utils/response'
import { PAGINATION, PRODUCT_TYPES } from '~~/app/types'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(PAGINATION.MIN_LIMIT, Number(query.limit) || PAGINATION.DEFAULT_LIMIT),
  )
  const skip = (page - 1) * limit

  const filter: Record<string, unknown> = { isDeleted: false }

  if (
    typeof query.productType === 'string' &&
    (PRODUCT_TYPES as readonly string[]).includes(query.productType)
  ) {
    filter.productType = query.productType
  }

  if (typeof query.year === 'string' && query.year.trim()) {
    const yearNum = Number(query.year)
    if (!Number.isNaN(yearNum) && yearNum > 1900 && yearNum <= new Date().getFullYear() + 1) {
      const startOfYear = new Date(yearNum, 0, 1)
      const endOfYear = new Date(yearNum + 1, 0, 1)
      filter['manualMetadata.date'] = { $gte: startOfYear, $lt: endOfYear }
    }
  }

  if (typeof query.owner === 'string' && query.owner.trim()) {
    filter.owner = query.owner.trim()
  }

  if (typeof query.institution === 'string' && query.institution.trim()) {
    const escaped = query.institution.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { 'extractedEntities.institution.value': { $regex: escaped, $options: 'i' } },
      { 'manualMetadata.institution': { $regex: escaped, $options: 'i' } },
    ]
  }

  if (typeof query.search === 'string' && query.search.trim()) {
    const searchTerm = query.search.trim()

    if (searchTerm.length >= 2 && !searchTerm.startsWith('-')) {
      filter.$text = { $search: searchTerm }
    } else {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regexFilter = {
        $or: [
          { 'manualMetadata.title': { $regex: escaped, $options: 'i' } },
          { 'manualMetadata.authors': { $regex: escaped, $options: 'i' } },
          { 'manualMetadata.keywords': { $regex: escaped, $options: 'i' } },
          { 'extractedEntities.title.value': { $regex: escaped, $options: 'i' } },
          { 'extractedEntities.authors.value': { $regex: escaped, $options: 'i' } },
        ],
      }

      if (filter.$or) {
        const institutionConditions = filter.$or
        delete filter.$or
        filter.$and = [{ $or: institutionConditions }, regexFilter]
      } else {
        filter.$or = regexFilter.$or
      }
    }
  }

  const sortOptions: Record<string, 1 | -1 | { $meta: string }> = filter.$text
    ? { score: { $meta: 'textScore' }, createdAt: -1 }
    : { 'manualMetadata.date': -1, createdAt: -1 }

  const [products, total] = await Promise.all([
    AcademicProduct.find(filter).sort(sortOptions).skip(skip).limit(limit).lean(),
    AcademicProduct.countDocuments(filter),
  ])

  return ok(products.map(toAcademicProductPublic), {
    total,
    page,
    limit,
    hasMore: skip + products.length < total,
  })
})
