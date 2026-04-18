import User from '~~/server/models/User'
import { verifyEmailSchema } from '~~/server/utils/schemas/auth'
import { enforceAuthRateLimit } from '~~/server/utils/auth-rate-limit'
import { createLoginSession } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'auth:verify-email')

  const body = await readBody(event)
  const parsed = verifyEmailSchema.safeParse(body)
  if (!parsed.success) throw createValidationError(parsed.error)

  const user = await User.findOne({ emailVerifyToken: parsed.data.token }).select(
    '+emailVerifyToken +emailVerifyExpires',
  )
  if (!user) throw createAuthenticationError('Enlace de verificación inválido')

  if (!user.emailVerifyExpires || user.emailVerifyExpires < new Date()) {
    throw createAuthenticationError('El enlace de verificación expiró. Solicita uno nuevo.')
  }

  user.emailVerifiedAt = new Date()
  user.emailVerifyToken = undefined
  user.emailVerifyExpires = undefined
  user.lastLoginAt = new Date()
  await user.save()

  const token = await createLoginSession(event, user)

  await logAudit(event, {
    userId: user._id,
    userName: user.fullName,
    action: 'update',
    resource: 'user',
    resourceId: user._id,
    details: 'Correo verificado',
  })

  return ok({ token, user: user.toJSON() })
})
