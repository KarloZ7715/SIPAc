import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '~~/server/models/User'
import { changePasswordSchema } from '~~/server/utils/schemas/auth'
import { revokeAllSessionsForUser, createLoginSession } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const body = await readBody(event)
  const parsed = changePasswordSchema.safeParse(body)

  if (!parsed.success) {
    throw createValidationError(parsed.error)
  }

  const { currentPassword, newPassword } = parsed.data

  const user = await User.findById(auth.sub).select('+passwordHash')
  if (!user) {
    throw createNotFoundError('Usuario')
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    throw createAuthenticationError('La contraseña actual es incorrecta')
  }

  user.passwordHash = newPassword
  await user.save()

  // Revoke all sessions except the current one by resetting sessions then recreating current
  await revokeAllSessionsForUser(auth.sub, 'password_change')
  const refreshed = await User.findById(auth.sub)
  if (refreshed) {
    await createLoginSession(event, refreshed)
  }

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'update',
    resource: 'user',
    resourceId: user._id,
    details: 'Usuario cambió su contraseña',
  })

  return ok({ message: 'Contraseña actualizada exitosamente' })
})
