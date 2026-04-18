import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '~~/server/models/User'
import { changeEmailSchema } from '~~/server/utils/schemas/auth'
import { sendEmail } from '~~/server/services/email/send-email'
import { changeEmailTemplate } from '~~/server/services/email/templates'
import { enforceAuthRateLimit } from '~~/server/utils/auth-rate-limit'

const CHANGE_EMAIL_TTL_MS = 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'auth:change-email')
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const body = await readBody(event)
  const parsed = changeEmailSchema.safeParse(body)
  if (!parsed.success) throw createValidationError(parsed.error)

  const { password, newEmail } = parsed.data

  const user = await User.findById(auth.sub).select('+passwordHash')
  if (!user) throw createNotFoundError('Usuario')

  const validPassword = await bcrypt.compare(password, user.passwordHash)
  if (!validPassword) {
    throw createAuthenticationError('Contraseña incorrecta')
  }

  if (newEmail === user.email) {
    throw createValidationError({
      issues: [{ path: ['newEmail'], message: 'El correo nuevo es igual al actual' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  const existing = await User.findOne({ email: newEmail }).lean()
  if (existing) {
    throw createValidationError({
      issues: [{ path: ['newEmail'], message: 'Ya existe una cuenta con ese correo' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  const token = crypto.randomBytes(32).toString('hex')
  user.pendingEmail = newEmail
  user.pendingEmailToken = token
  user.pendingEmailExpires = new Date(Date.now() + CHANGE_EMAIL_TTL_MS)
  await user.save()

  const tpl = changeEmailTemplate({ fullName: user.fullName, token, newEmail })
  await sendEmail({ to: newEmail, subject: tpl.subject, html: tpl.html })

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'update',
    resource: 'user',
    resourceId: user._id,
    details: 'Solicitud de cambio de correo',
  })

  return ok({ message: 'Te enviamos un correo para confirmar el cambio.' })
})
