import mongoose from 'mongoose'
import AuditLog from '~~/server/models/AuditLog'
import type { ProfileActivityItem } from '~~/app/types'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const query = getQuery(event)
  const rawLimit = Number(query.limit ?? 20)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 20

  const ownerId = new mongoose.Types.ObjectId(auth.sub)

  const logs = await AuditLog.find({ userId: ownerId }).sort({ createdAt: -1 }).limit(limit).lean()

  const items: ProfileActivityItem[] = logs.map((log) => ({
    _id: log._id.toString(),
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId ? log.resourceId.toString() : undefined,
    details: log.details ?? undefined,
    createdAt: new Date(log.createdAt).toISOString(),
  }))

  return ok({ items })
})
