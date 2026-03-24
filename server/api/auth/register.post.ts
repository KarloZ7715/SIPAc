import User from '~~/server/models/User'
import { registerSchema } from '~~/server/utils/schemas'
import { signToken } from '~~/server/utils/jwt'
import { createValidationError, createConflictError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'
import { logAudit } from '~~/server/utils/audit'
import { enforceAuthRateLimit } from '~~/server/utils/auth-rate-limit'

export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'auth:register')

  const body = await readBody(event)

  const result = registerSchema.safeParse(body)
  if (!result.success) {
    throw createValidationError(result.error)
  }

  const { fullName, email, password, program } = result.data

  const existingUser = await User.findOne({ email }).lean()
  if (existingUser) {
    throw createConflictError('Ya existe una cuenta con este correo electrónico')
  }

  const user = await User.create({
    fullName,
    email,
    passwordHash: password,
    program,
  })

  const token = await signToken({
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  })

  setCookie(event, 'sipac_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 28800,
  })

  await logAudit(event, {
    userId: user._id,
    userName: user.fullName,
    action: 'create',
    resource: 'user',
    resourceId: user._id,
    details: 'Registro de nuevo usuario',
  })

  setResponseStatus(event, 201)
  return ok({ token, user: user.toJSON() })
})
