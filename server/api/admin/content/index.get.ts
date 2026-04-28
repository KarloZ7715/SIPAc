import AcademicProduct from '~~/server/models/AcademicProduct'
import { requireRole } from '~~/server/utils/authorize'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  requireRole(event, 'admin')

  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = Math.max(1, Math.min(100, parseInt(query.limit as string) || 20))
  const skip = (page - 1) * limit

  const search = query.search as string
  const type = query.type as string
  const status = query.status as string
  const ownerId = query.ownerId as string
  const isDeleted = query.isDeleted === 'true'

  const filter: Record<string, unknown> = {}

  if (!isDeleted) {
    filter.isDeleted = false
  }

  if (type) {
    filter.productType = type
  }

  if (status) {
    filter.reviewStatus = status
  }

  if (ownerId) {
    filter.owner = ownerId
  }

  if (search) {
    // Basic text search if the index is created, or regex fallback
    filter.$or = [
      { 'manualMetadata.title': { $regex: search, $options: 'i' } },
      { 'extractedEntities.title.value': { $regex: search, $options: 'i' } },
    ]
  }

  const [products, total] = await Promise.all([
    AcademicProduct.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('owner', 'fullName email program')
      .lean(),
    AcademicProduct.countDocuments(filter),
  ])

  return ok(
    { products },
    {
      page,
      limit,
      total,
      hasMore: total > page * limit,
    },
  )
})
