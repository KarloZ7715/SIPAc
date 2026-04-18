import mongoose from 'mongoose'
import Session from '~~/server/models/Session'
import type { ProfileSessionItem } from '~~/app/types'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const ownerId = new mongoose.Types.ObjectId(auth.sub)

  const sessions = await Session.find({
    userId: ownerId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastSeenAt: -1 })
    .lean()

  const currentJti = auth.jti

  const items: ProfileSessionItem[] = sessions.map((s) => ({
    _id: s._id.toString(),
    ipAddress: s.ipAddress ?? 'unknown',
    userAgent: s.userAgent ?? undefined,
    createdAt: new Date(s.createdAt).toISOString(),
    lastSeenAt: new Date(s.lastSeenAt).toISOString(),
    isCurrent: s.jti === currentJti,
  }))

  return ok({ items })
})
