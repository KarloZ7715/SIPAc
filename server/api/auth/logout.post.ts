import { requireAuth } from '~~/server/utils/authorize'
import { clearSessionCookie } from '~~/server/utils/session'
import Session from '~~/server/models/Session'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (auth.jti) {
    await Session.updateOne(
      { jti: auth.jti },
      { $set: { revokedAt: new Date(), revokedReason: 'user' } },
    )
  }

  clearSessionCookie(event)

  return ok({ message: 'Sesión cerrada exitosamente' })
})
