import crypto from 'node:crypto'
import User from '~~/server/models/User'
import { resendVerificationSchema } from '~~/server/utils/schemas/auth'
import { enforceAuthRateLimit } from '~~/server/utils/auth-rate-limit'
import { sendEmail } from '~~/server/services/email/send-email'
import { verifyEmailTemplate } from '~~/server/services/email/templates'

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'auth:resend-verification')

  const body = await readBody(event)
  const parsed = resendVerificationSchema.safeParse(body)
  if (!parsed.success) throw createValidationError(parsed.error)

  const user = await User.findOne({ email: parsed.data.email })

  // Always return generic success to avoid enumeration.
  if (!user || user.emailVerifiedAt) {
    return ok({ message: 'Si la cuenta existe y está pendiente, enviamos un nuevo enlace.' })
  }

  const token = crypto.randomBytes(32).toString('hex')
  user.emailVerifyToken = token
  user.emailVerifyExpires = new Date(Date.now() + VERIFY_TTL_MS)
  await user.save()

  const tpl = verifyEmailTemplate({ fullName: user.fullName, token })
  await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html })

  return ok({ message: 'Si la cuenta existe y está pendiente, enviamos un nuevo enlace.' })
})
