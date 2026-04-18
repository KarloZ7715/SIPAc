import bcrypt from 'bcrypt'
import User from '~~/server/models/User'
import { twoFactorVerifySchema } from '~~/server/utils/schemas/auth'
import { enforceAuthRateLimit } from '~~/server/utils/auth-rate-limit'
import { createLoginSession } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'auth:2fa-verify')

  const body = await readBody(event)
  const parsed = twoFactorVerifySchema.safeParse(body)
  if (!parsed.success) throw createValidationError(parsed.error)

  const { challengeId, code } = parsed.data

  const user = await User.findOne({ loginChallengeId: challengeId }).select(
    '+twoFactorOtpHash +twoFactorOtpExpires +loginChallengeId +loginChallengeExpires',
  )
  if (!user) throw createAuthenticationError('Desafío inválido')

  if (!user.loginChallengeExpires || user.loginChallengeExpires < new Date()) {
    throw createAuthenticationError('El desafío expiró. Vuelve a iniciar sesión.')
  }

  if (
    !user.twoFactorOtpHash ||
    !user.twoFactorOtpExpires ||
    user.twoFactorOtpExpires < new Date()
  ) {
    throw createAuthenticationError('El código expiró. Vuelve a iniciar sesión.')
  }

  const valid = await bcrypt.compare(code, user.twoFactorOtpHash)
  if (!valid) {
    await user.incrementLoginAttempts()
    throw createAuthenticationError('Código inválido')
  }

  user.twoFactorOtpHash = undefined
  user.twoFactorOtpExpires = undefined
  user.loginChallengeId = undefined
  user.loginChallengeExpires = undefined
  user.failedLoginAttempts = 0
  user.lockUntil = undefined as unknown as Date
  user.lastLoginAt = new Date()
  await user.save()

  const token = await createLoginSession(event, user)

  await logAudit(event, {
    userId: user._id,
    userName: user.fullName,
    action: 'login',
    resource: 'session',
    details: 'Login 2FA verificado',
  })

  return ok({ token, user: user.toJSON() })
})
