import type { H3Event } from 'h3'
import { verifyToken } from '~~/server/utils/jwt'
import type { TokenPayload } from '~~/server/utils/jwt'
import { createAuthenticationError } from '~~/server/utils/errors'

declare module 'h3' {
  interface H3EventContext {
    auth?: TokenPayload
  }
}

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]

export default defineEventHandler(async (event: H3Event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/') || PUBLIC_ROUTES.includes(path)) {
    return
  }

  // Read token from httpOnly cookie
  const token = getCookie(event, 'sipac_session')
  if (!token) {
    throw createAuthenticationError('Token de autenticación requerido')
  }

  try {
    const payload = await verifyToken(token)
    event.context.auth = payload
  } catch {
    throw createAuthenticationError('Token inválido o expirado')
  }
})
