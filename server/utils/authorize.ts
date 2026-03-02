import { type H3Event } from 'h3'
import { type UserRole } from '~~/app/types'
import { createAuthenticationError, createAuthorizationError } from './errors'

export function requireAuth(event: H3Event) {
  const auth = event.context.auth
  if (!auth) throw createAuthenticationError()
  return auth
}

export function requireRole(event: H3Event, ...roles: UserRole[]) {
  const auth = requireAuth(event)
  if (!roles.includes(auth.role as UserRole)) {
    throw createAuthorizationError()
  }
  return auth
}
