import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '~~/server/models/User'
import { sendEmail } from '~~/server/services/email/send-email'
import { otpEnableTemplate } from '~~/server/services/email/templates'
import { enforceAuthRateLimit } from '~~/server/utils/auth-rate-limit'

const OTP_TTL_MS = 10 * 60 * 1000

export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'auth:2fa-enable')
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const user = await User.findById(auth.sub)
  if (!user) throw createNotFoundError('Usuario')
  if (user.twoFactorEnabled) {
    throw createValidationError({
      issues: [{ path: [], message: '2FA ya está activo' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  user.twoFactorOtpHash = await bcrypt.hash(code, 10)
  user.twoFactorOtpExpires = new Date(Date.now() + OTP_TTL_MS)
  await user.save()

  const tpl = otpEnableTemplate({ fullName: user.fullName, code })
  await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html })

  return ok({ message: 'Enviamos un código a tu correo. Ingrésalo para confirmar.' })
})
