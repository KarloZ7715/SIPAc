import crypto from 'node:crypto'
import { decodeIdToken } from 'arctic'
import User from '~~/server/models/User'
import { assertGoogleConfigured } from '~~/server/utils/google-oauth'
import { createLoginSession } from '~~/server/utils/session'
import { buildFullName } from '~~/server/utils/full-name'

interface GoogleIdTokenClaims {
  sub: string
  email?: string
  email_verified?: boolean
  given_name?: string
  family_name?: string
  name?: string
  picture?: string
}

export default defineEventHandler(async (event) => {
  const google = assertGoogleConfigured()
  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : ''
  const state = typeof query.state === 'string' ? query.state : ''

  const cookieState = getCookie(event, 'google_oauth_state')
  const cookieVerifier = getCookie(event, 'google_oauth_verifier')

  deleteCookie(event, 'google_oauth_state')
  deleteCookie(event, 'google_oauth_verifier')

  if (!code || !state || !cookieState || !cookieVerifier || state !== cookieState) {
    return sendRedirect(event, '/login?error=oauth_state', 302)
  }

  try {
    const tokens = await google.validateAuthorizationCode(code, cookieVerifier)
    const claims = decodeIdToken(tokens.idToken()) as GoogleIdTokenClaims

    if (!claims.email || !claims.email_verified) {
      return sendRedirect(event, '/login?error=oauth_email', 302)
    }

    const googleId = claims.sub
    const email = claims.email.toLowerCase()

    let user = await User.findOne({ $or: [{ googleId }, { email }] })

    if (!user) {
      const fullName = buildFullName({
        firstName: claims.given_name ?? '',
        lastName: claims.family_name ?? '',
        fallback: claims.name ?? email,
      })
      const randomPassword = crypto.randomUUID() + crypto.randomUUID()
      user = await User.create({
        fullName,
        firstName: claims.given_name || undefined,
        lastName: claims.family_name || undefined,
        email,
        passwordHash: randomPassword,
        googleId,
        emailVerifiedAt: new Date(),
      })
    } else if (!user.googleId) {
      user.googleId = googleId
      if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date()
      await user.save()
    }

    if (!user.isActive) {
      return sendRedirect(event, '/login?error=oauth_inactive', 302)
    }

    user.lastLoginAt = new Date()
    await user.save()

    await createLoginSession(event, user)

    await logAudit(event, {
      userId: user._id,
      userName: user.fullName,
      action: 'login',
      resource: 'session',
      details: 'Google OAuth',
    })

    return sendRedirect(event, '/', 302)
  } catch (error) {
    console.error('[google-oauth] callback error:', error)
    return sendRedirect(event, '/login?error=oauth_failed', 302)
  }
})
