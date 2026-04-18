import mongoose from 'mongoose'
import { revokeAllSessionsForUser, clearSessionCookie } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  await revokeAllSessionsForUser(auth.sub, 'revoke_all')
  clearSessionCookie(event)

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'delete',
    resource: 'session',
    details: 'Usuario revocó todas las sesiones (logout global)',
  })

  return ok({ message: 'Todas tus sesiones fueron cerradas' })
})
