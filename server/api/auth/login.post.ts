import bcrypt from 'bcrypt'
import User from '~~/server/models/User'
import { loginSchema } from '~~/server/utils/schemas'
import { signToken } from '~~/server/utils/jwt'
import {
  createValidationError,
  createAuthenticationError,
  createAuthorizationError,
  createAccountLockedError,
} from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'
import { logAudit } from '~~/server/utils/audit'
import { enforceAuthRateLimit } from '~~/server/utils/auth-rate-limit'

export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'auth:login')

  const body = await readBody(event)

  const result = loginSchema.safeParse(body)
  if (!result.success) {
    throw createValidationError(result.error)
  }

  const { email, password } = result.data

  const user = await User.findOne({ email }).select('+passwordHash +failedLoginAttempts +lockUntil')

  if (!user) {
    throw createAuthenticationError('Credenciales inválidas')
  }

  if (!user.isActive) {
    throw createAuthorizationError('Cuenta desactivada. Contacta al administrador')
  }

  if (user.isLocked()) {
    const minutesLeft = Math.ceil((user.lockUntil!.getTime() - Date.now()) / 60000)
    throw createAccountLockedError(minutesLeft)
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash)

  if (!isValidPassword) {
    await user.incrementLoginAttempts()

    await logAudit(event, {
      userId: user._id,
      userName: user.fullName,
      action: 'login_failed',
      resource: 'session',
      details: `Intento fallido #${user.failedLoginAttempts}`,
    })

    throw createAuthenticationError('Credenciales inválidas')
  }

  await user.resetLoginAttempts()

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
    action: 'login',
    resource: 'session',
  })

  return ok({ token, user: user.toJSON() })
})
