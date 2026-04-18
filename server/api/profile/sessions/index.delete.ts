import mongoose from 'mongoose'
import Session from '~~/server/models/Session'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub) || !auth.jti) {
    throw createAuthenticationError()
  }

  // Revoke all sessions except current
  const result = await Session.updateMany(
    { userId: auth.sub, jti: { $ne: auth.jti }, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'user' } },
  )

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'delete',
    resource: 'session',
    details: `Cerró ${result.modifiedCount} sesiones remotas`,
  })

  return ok({ message: 'Otras sesiones cerradas', count: result.modifiedCount })
})
