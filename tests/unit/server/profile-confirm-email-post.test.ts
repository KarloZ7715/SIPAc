import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const userFindOneMock = vi.hoisted(() => vi.fn())
const revokeAllSessionsForUserMock = vi.hoisted(() => vi.fn())
const clearSessionCookieMock = vi.hoisted(() => vi.fn())
const enforceAuthRateLimitMock = vi.hoisted(() => vi.fn())

vi.mock('~~/server/models/User', () => ({
  default: {
    findOne: userFindOneMock,
  },
}))

vi.mock('~~/server/utils/session', () => ({
  revokeAllSessionsForUser: revokeAllSessionsForUserMock,
  clearSessionCookie: clearSessionCookieMock,
}))

vi.mock('~~/server/utils/auth-rate-limit', () => ({
  enforceAuthRateLimit: enforceAuthRateLimitMock,
}))

vi.mock('~~/server/utils/audit', () => ({
  logAudit: vi.fn(),
}))

type MockUserDoc = {
  _id: { toString(): string }
  fullName: string
  pendingEmail: string
  email: string
  pendingEmailToken?: string
  pendingEmailExpires?: Date
  emailVerifiedAt?: Date
  save: ReturnType<typeof vi.fn>
}

describe('POST /api/profile/confirm-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('readBody', async (event: { body?: unknown }) => event.body)
    vi.stubGlobal('ok', (payload: unknown) => ({ success: true, data: payload }))
    vi.stubGlobal('createValidationError', (issues: unknown) => {
      const error = new Error('Validation error')
      Object.assign(error, { statusCode: 400, data: issues })
      return error
    })
    vi.stubGlobal('createAuthenticationError', (message?: string) => {
      const error = new Error(message ?? 'Unauthorized')
      Object.assign(error, { statusCode: 401 })
      return error
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('aplica el correo pendiente y revoca todas las sesiones', async () => {
    const user: MockUserDoc = {
      _id: { toString: () => 'user-id-1' },
      fullName: 'Ada Lovelace',
      pendingEmail: 'nuevo@institucion.edu.co',
      email: 'viejo@institucion.edu.co',
      pendingEmailToken: 'secret-token',
      pendingEmailExpires: new Date(Date.now() + 60_000),
      save: vi.fn().mockResolvedValue(undefined),
    }

    userFindOneMock.mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    })

    const { default: handler } = await import('~~/server/api/profile/confirm-email.post')

    const result = await handler({
      body: { token: 'secret-token' },
    } as never)

    expect(enforceAuthRateLimitMock).toHaveBeenCalledWith(
      expect.anything(),
      'profile:confirm-email',
    )
    expect(user.email).toBe('nuevo@institucion.edu.co')
    expect(user.pendingEmail).toBeUndefined()
    expect(user.save).toHaveBeenCalled()
    expect(revokeAllSessionsForUserMock).toHaveBeenCalledWith('user-id-1', 'email_change')
    expect(clearSessionCookieMock).toHaveBeenCalled()
    expect(result).toEqual({
      success: true,
      data: {
        message: 'Correo actualizado. Vuelve a iniciar sesión.',
        email: 'nuevo@institucion.edu.co',
      },
    })
  })

  it('rechaza token inválido', async () => {
    userFindOneMock.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    })

    const { default: handler } = await import('~~/server/api/profile/confirm-email.post')

    await expect(handler({ body: { token: 'bad' } } as never)).rejects.toMatchObject({
      statusCode: 401,
    })
    expect(revokeAllSessionsForUserMock).not.toHaveBeenCalled()
  })
})
