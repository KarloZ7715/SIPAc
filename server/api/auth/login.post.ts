import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import User from '~~/server/models/User'
import { loginSchema } from '~~/server/utils/schemas'
import {
  createValidationError,
  createAuthenticationError,
  createAuthorizationError,
  createAccountLockedError,
} from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'
import { logAudit } from '~~/server/utils/audit'
import { enforceAuthRateLimit } from '~~/server/utils/auth-rate-limit'
import { createLoginSession } from '~~/server/utils/session'
import { sendEmail } from '~~/server/services/email/send-email'
import { otpLoginTemplate, verifyEmailTemplate } from '~~/server/services/email/templates'

const CHALLENGE_TTL_MS = 5 * 60 * 1000

export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'auth:login')

  const body = await readBody(event)
  const result = loginSchema.safeParse(body)
  if (!result.success) {
    throw createValidationError(result.error)
  }

  const { email, password } = result.data

  const user = await User.findOne({ email }).select(
    '+passwordHash +failedLoginAttempts +lockUntil +twoFactorOtpHash +twoFactorOtpExpires +loginChallengeId +loginChallengeExpires',
  )

  if (!user) {
    throw createAuthenticationError('Credenciales inválidas')
  }

  if (!user.isActive) {
    throw createAuthorizationError('Cuenta desactivada. Contacta al administrador')
  }

  if (user.isLocked()) {
    const minutesLeft = Math.ceil((user.lockUntil!.getTime() - Date.now()) / 60000)
    throw createAccountLockedError(minutesLeft)
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash)

  if (!isValidPassword) {
    await user.incrementLoginAttempts()
    await logAudit(event, {
      userId: user._id,
      userName: user.fullName,
      action: 'login_failed',
      resource: 'session',
      details: `Intento fallido #${user.failedLoginAttempts}`,
    })
    throw createAuthenticationError('Credenciales inválidas')
  }

  // Block login if email not verified — send/refresh the verification email automatically
  if (!user.emailVerifiedAt && !user.googleId) {
    const VERIFY_TTL_MS = 24 * 60 * 60 * 1000
    const token = crypto.randomBytes(32).toString('hex')
    user.emailVerifyToken = token
    user.emailVerifyExpires = new Date(Date.now() + VERIFY_TTL_MS)
    await user.save()
    const tpl = verifyEmailTemplate({ fullName: user.fullName, token })
    await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html })
    return ok({ requiresVerification: true, email: user.email })
  }

  // If 2FA enabled, send OTP and return challenge
  if (user.twoFactorEnabled) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    const codeHash = await bcrypt.hash(code, 10)
    const challengeId = crypto.randomUUID()

    user.twoFactorOtpHash = codeHash
    user.twoFactorOtpExpires = new Date(Date.now() + CHALLENGE_TTL_MS)
    user.loginChallengeId = challengeId
    user.loginChallengeExpires = new Date(Date.now() + CHALLENGE_TTL_MS)
    await user.save()

    const tpl = otpLoginTemplate({ fullName: user.fullName, code })
    await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html })

    return ok({ requires2FA: true, challengeId, email: user.email })
  }

  // Normal login flow
  await user.resetLoginAttempts()
  user.lastLoginAt = new Date()
  await user.save()

  const token = await createLoginSession(event, user)

  await logAudit(event, {
    userId: user._id,
    userName: user.fullName,
    action: 'login',
    resource: 'session',
  })

  return ok({
    token,
    user: user.toJSON(),
    defaultLanding: user.preferences?.defaultLanding || 'dashboard',
  })
})
