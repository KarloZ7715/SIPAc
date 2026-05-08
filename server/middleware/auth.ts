import type { H3Event } from 'h3'
import mongoose from 'mongoose'
import { verifyToken } from '~~/server/utils/jwt'
import type { TokenPayload } from '~~/server/utils/jwt'
import { createAuthenticationError, createServiceUnavailableError } from '~~/server/utils/errors'
import Session from '~~/server/models/Session'
import User from '~~/server/models/User'

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
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/2fa/verify',
  '/api/auth/google/start',
  '/api/auth/google/callback',
  /** Post público: token en body + rate limit en handler */
  '/api/profile/confirm-email',
  /** Bearer CLEANUP_CRON_SECRET en handler; sin JWT de usuario */
  '/api/system/cleanup-drafts',
]

export default defineEventHandler(async (event: H3Event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/') || PUBLIC_ROUTES.includes(path)) {
    return
  }

  const token = getCookie(event, 'sipac_session')
  if (!token) {
    throw createAuthenticationError('Token de autenticación requerido')
  }

  let payload: TokenPayload
  try {
    payload = await verifyToken(token)
  } catch {
    throw createAuthenticationError('Token inválido o expirado')
  }

  if (mongoose.connection.readyState !== 1) {
    throw createServiceUnavailableError(
      'Base de datos no disponible. Intenta de nuevo en unos segundos.',
    )
  }

  if (!payload.jti) {
    throw createAuthenticationError('Sesión inválida')
  }

  // Check in-memory LRU auth cache before hitting MongoDB
  const cached = getAuthCache(payload.jti, payload.sub)
  if (cached) {
    if (cached.session.revokedAt || cached.session.expiresAt < new Date()) {
      throw createAuthenticationError('Sesión cerrada o expirada')
    }
    if (!cached.user.isActive) {
      throw createAuthenticationError('Usuario inactivo')
    }
    if ((cached.user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
      throw createAuthenticationError('Sesión revocada')
    }
  } else {
    const [session, user] = await Promise.all([
      Session.findOne({ jti: payload.jti, userId: payload.sub }).lean(),
      User.findById(payload.sub).select('tokenVersion isActive').lean(),
    ])

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw createAuthenticationError('Sesión cerrada o expirada')
    }
    if (!user || !user.isActive) {
      throw createAuthenticationError('Usuario inactivo')
    }
    if ((user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
      throw createAuthenticationError('Sesión revocada')
    }

    // Cache the successful auth result (TTL 60s)
    setAuthCache(
      payload.jti,
      payload.sub,
      { _id: session._id, revokedAt: session.revokedAt, expiresAt: session.expiresAt },
      { tokenVersion: user.tokenVersion, isActive: user.isActive },
    )

    // best-effort lastSeen update (fire and forget)
    Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } }).catch((err) => {
      console.error('[Auth] Error al actualizar lastSeenAt de sesión:', err)
    })
  }

  event.context.auth = payload
})
