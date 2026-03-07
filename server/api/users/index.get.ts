import User from '~~/server/models/User'
import { PAGINATION } from '~~/app/types'

export default defineEventHandler(async (event) => {
  requireRole(event, 'admin')

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(PAGINATION.MIN_LIMIT, Number(query.limit) || PAGINATION.DEFAULT_LIMIT),
  )
  const skip = (page - 1) * limit

  const filter: Record<string, unknown> = {}

  if (query.role === 'admin' || query.role === 'docente') {
    filter.role = query.role
  }

  if (query.isActive === 'true') filter.isActive = true
  else if (query.isActive === 'false') filter.isActive = false

  if (typeof query.search === 'string' && query.search.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { fullName: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ]
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ])

  return ok(users, {
    total,
    page,
    limit,
    hasMore: skip + users.length < total,
  })
})
