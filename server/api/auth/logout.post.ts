import { requireAuth } from '~~/server/utils/authorize'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  deleteCookie(event, 'sipac_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  })

  return ok({ message: 'Sesión cerrada exitosamente' })
})
