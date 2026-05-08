import User from '~~/server/models/User'
import { verifyEmailSchema } from '~~/server/utils/schemas/auth'
import { enforceAuthRateLimit } from '~~/server/utils/auth-rate-limit'
import { createAuthenticationError, createValidationError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'
import { logAudit } from '~~/server/utils/audit'
import { revokeAllSessionsForUser, clearSessionCookie } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'profile:confirm-email')

  const body = await readBody(event)
  const parsed = verifyEmailSchema.safeParse(body)
  if (!parsed.success) {
    throw createValidationError(parsed.error)
  }

  const user = await User.findOne({
    pendingEmailToken: parsed.data.token,
    pendingEmailExpires: { $gt: new Date() },
  }).select('+pendingEmailToken +pendingEmailExpires')

  if (!user || !user.pendingEmail) {
    throw createAuthenticationError('Enlace de confirmación inválido o expirado')
  }

  const newEmail = user.pendingEmail
  user.email = newEmail
  user.pendingEmail = undefined
  user.pendingEmailToken = undefined
  user.pendingEmailExpires = undefined
  user.emailVerifiedAt = new Date()
  await user.save()

  await revokeAllSessionsForUser(user._id.toString(), 'email_change')
  clearSessionCookie(event)

  await logAudit(event, {
    userId: user._id,
    userName: user.fullName,
    action: 'update',
    resource: 'user',
    resourceId: user._id,
    details: `Cambio de correo confirmado → ${newEmail}`,
  })

  return ok({ message: 'Correo actualizado. Vuelve a iniciar sesión.', email: newEmail })
})
