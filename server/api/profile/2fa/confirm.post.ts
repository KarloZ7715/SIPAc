import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '~~/server/models/User'
import { twoFactorConfirmSchema } from '~~/server/utils/schemas/auth'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const body = await readBody(event)
  const parsed = twoFactorConfirmSchema.safeParse(body)
  if (!parsed.success) throw createValidationError(parsed.error)

  const user = await User.findById(auth.sub).select('+twoFactorOtpHash +twoFactorOtpExpires')
  if (!user) throw createNotFoundError('Usuario')

  if (
    !user.twoFactorOtpHash ||
    !user.twoFactorOtpExpires ||
    user.twoFactorOtpExpires < new Date()
  ) {
    throw createAuthenticationError('El código expiró. Solicita uno nuevo.')
  }

  const valid = await bcrypt.compare(parsed.data.code, user.twoFactorOtpHash)
  if (!valid) throw createAuthenticationError('Código inválido')

  user.twoFactorEnabled = true
  user.twoFactorOtpHash = undefined
  user.twoFactorOtpExpires = undefined
  await user.save()

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'update',
    resource: 'user',
    resourceId: user._id,
    details: '2FA activado',
  })

  return ok({ message: 'Verificación en dos pasos activada' })
})
