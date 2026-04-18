import User from '~~/server/models/User'
import { revokeAllSessionsForUser, clearSessionCookie } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const { token } = getQuery(event) as { token?: string }
  if (!token) {
    throw createValidationError({
      issues: [{ path: ['token'], message: 'Token requerido' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  const user = await User.findOne({
    pendingEmailToken: token,
    pendingEmailExpires: { $gt: new Date() },
  }).select('+pendingEmailToken +pendingEmailExpires')

  if (!user || !user.pendingEmail) {
    throw createValidationError({
      issues: [{ path: ['token'], message: 'Token inválido o expirado' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
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
