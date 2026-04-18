import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import { deleteCookie } from 'h3'
import { z } from 'zod'
import User from '~~/server/models/User'

const deactivateSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const body = await readBody(event)
  const parsed = deactivateSchema.safeParse(body)
  if (!parsed.success) {
    throw createValidationError(parsed.error)
  }

  const user = await User.findById(auth.sub).select('+passwordHash')
  if (!user) {
    throw createNotFoundError('Usuario')
  }

  const isValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!isValid) {
    throw createAuthenticationError('Contraseña actual incorrecta')
  }

  user.isActive = false
  await user.save()

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'update',
    resource: 'user',
    resourceId: user._id,
    details: 'Cuenta desactivada por el usuario',
  })

  deleteCookie(event, 'sipac_session', { path: '/' })

  return ok({ ok: true })
})
