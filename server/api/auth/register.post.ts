import crypto from 'node:crypto'
import User from '~~/server/models/User'
import { registerSchema } from '~~/server/utils/schemas'
import { createValidationError, createConflictError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'
import { logAudit } from '~~/server/utils/audit'
import { enforceAuthRateLimit } from '~~/server/utils/auth-rate-limit'
import { buildFullName } from '~~/server/utils/full-name'
import { sendEmail } from '~~/server/services/email/send-email'
import { verifyEmailTemplate } from '~~/server/services/email/templates'

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'auth:register')

  const body = await readBody(event)
  const result = registerSchema.safeParse(body)
  if (!result.success) {
    throw createValidationError(result.error)
  }

  const { fullName, firstName, middleName, lastName, secondLastName, email, password, program } =
    result.data

  const existingUser = await User.findOne({ email }).lean()
  if (existingUser) {
    throw createConflictError('Ya existe una cuenta con este correo electrónico')
  }

  const finalFullName = buildFullName({
    firstName,
    middleName,
    lastName,
    secondLastName,
    fallback: fullName ?? '',
  })

  const token = crypto.randomBytes(32).toString('hex')

  const user = await User.create({
    fullName: finalFullName,
    firstName: firstName ?? undefined,
    middleName: middleName || undefined,
    lastName: lastName ?? undefined,
    secondLastName: secondLastName || undefined,
    email,
    passwordHash: password,
    program,
    emailVerifyToken: token,
    emailVerifyExpires: new Date(Date.now() + VERIFY_TTL_MS),
  })

  const tpl = verifyEmailTemplate({ fullName: finalFullName, token })
  await sendEmail({ to: email, subject: tpl.subject, html: tpl.html })

  await logAudit(event, {
    userId: user._id,
    userName: user.fullName,
    action: 'create',
    resource: 'user',
    resourceId: user._id,
    details: 'Registro con verificación pendiente',
  })

  setResponseStatus(event, 201)
  return ok({ requiresVerification: true, email })
})
