import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '~~/server/models/User'
import { sendEmail } from '~~/server/services/email/send-email'
import { otpLoginTemplate } from '~~/server/services/email/templates'
import { twoFactorDisableSchema } from '~~/server/utils/schemas/auth'

const OTP_TTL_MS = 10 * 60 * 1000

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const body = await readBody(event)

  // If no code supplied, return a challenge - send OTP to email
  if (!body || typeof body !== 'object' || !('code' in body) || !body.code) {
    const user = await User.findById(auth.sub)
    if (!user) throw createNotFoundError('Usuario')
    if (!user.twoFactorEnabled) {
      return ok({ message: '2FA ya estaba desactivado' })
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    user.twoFactorOtpHash = await bcrypt.hash(code, 10)
    user.twoFactorOtpExpires = new Date(Date.now() + OTP_TTL_MS)
    await user.save()
    const tpl = otpLoginTemplate({ fullName: user.fullName, code })
    await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html })
    return ok({ challenge: true, message: 'Código enviado a tu correo' })
  }

  const parsed = twoFactorDisableSchema.safeParse(body)
  if (!parsed.success) throw createValidationError(parsed.error)

  const user = await User.findById(auth.sub).select(
    '+passwordHash +twoFactorOtpHash +twoFactorOtpExpires',
  )
  if (!user) throw createNotFoundError('Usuario')

  const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!validPassword) throw createAuthenticationError('Contraseña incorrecta')

  if (
    !user.twoFactorOtpHash ||
    !user.twoFactorOtpExpires ||
    user.twoFactorOtpExpires < new Date()
  ) {
    throw createAuthenticationError('Código expirado')
  }
  const validCode = await bcrypt.compare(parsed.data.code, user.twoFactorOtpHash)
  if (!validCode) throw createAuthenticationError('Código inválido')

  user.twoFactorEnabled = false
  user.twoFactorOtpHash = undefined
  user.twoFactorOtpExpires = undefined
  await user.save()

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'update',
    resource: 'user',
    resourceId: user._id,
    details: '2FA desactivado',
  })

  return ok({ message: 'Verificación en dos pasos desactivada' })
})
