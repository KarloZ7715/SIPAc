import { type H3Event } from 'h3'
import { verifyToken, type TokenPayload } from '~~/server/utils/jwt'
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

  const authorization = getHeader(event, 'authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw createAuthenticationError('Token de autenticación requerido')
  }

  const token = authorization.slice(7)

  try {
    const payload = await verifyToken(token)
    event.context.auth = payload
  } catch {
    throw createAuthenticationError('Token inválido o expirado')
  }
})
