import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import Session from '~~/server/models/Session'
import User from '~~/server/models/User'
import type { IUserDocument } from '~~/server/models/User'
import { signToken, JWT_EXPIRATION_SECONDS } from '~~/server/utils/jwt'

const SESSION_COOKIE = 'sipac_session'

export function getClientIp(event: H3Event): string | undefined {
  const xff = getRequestHeader(event, 'x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const xReal = getRequestHeader(event, 'x-real-ip')
  if (xReal) return xReal.trim()
  return undefined
}

export function getClientUserAgent(event: H3Event): string | undefined {
  return getRequestHeader(event, 'user-agent')?.slice(0, 512)
}

export async function createLoginSession(event: H3Event, user: IUserDocument): Promise<string> {
  const jti = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + JWT_EXPIRATION_SECONDS * 1000)

  await Session.create({
    userId: user._id,
    jti,
    ipAddress: getClientIp(event),
    userAgent: getClientUserAgent(event),
    lastSeenAt: now,
    expiresAt,
  })

  const token = await signToken({
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
    jti,
    tokenVersion: user.tokenVersion ?? 0,
  })

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: JWT_EXPIRATION_SECONDS,
  })

  return token
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  })
}

export async function revokeAllSessionsForUser(
  userId: string,
  reason: 'password_change' | 'email_change' | 'revoke_all',
): Promise<void> {
  await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  )
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } })
}
