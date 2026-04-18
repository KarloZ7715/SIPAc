import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { userFindOneMock, createLoginSessionMock, enforceAuthRateLimitMock, logAuditMock } =
  vi.hoisted(() => ({
    userFindOneMock: vi.fn(),
    createLoginSessionMock: vi.fn(),
    enforceAuthRateLimitMock: vi.fn(),
    logAuditMock: vi.fn(),
  }))

vi.mock('~~/server/models/User', () => ({
  default: {
    findOne: userFindOneMock,
  },
}))

vi.mock('~~/server/utils/session', () => ({
  createLoginSession: createLoginSessionMock,
}))

vi.mock('~~/server/utils/auth-rate-limit', () => ({
  enforceAuthRateLimit: enforceAuthRateLimitMock,
}))

type MockUserDoc = {
  _id: { toString(): string }
  fullName: string
  emailVerifiedAt?: Date
  emailVerifyToken?: string
  emailVerifyExpires?: Date
  lastLoginAt?: Date
  save: ReturnType<typeof vi.fn>
  toJSON: ReturnType<typeof vi.fn>
}

function makeUser(overrides: Partial<MockUserDoc> = {}): MockUserDoc {
  const user: MockUserDoc = {
    _id: { toString: () => 'user-id' },
    fullName: 'Ada Lovelace',
    emailVerifyToken: 'valid-token',
    emailVerifyExpires: new Date(Date.now() + 60_000),
    save: vi.fn().mockResolvedValue(undefined),
    toJSON: vi.fn().mockReturnValue({ id: 'user-id', fullName: 'Ada Lovelace' }),
    ...overrides,
  }
  return user
}

describe('POST /api/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('readBody', async (event: { body?: unknown }) => event.body)
    vi.stubGlobal('ok', (payload: unknown) => ({ success: true, data: payload }))
    vi.stubGlobal('logAudit', logAuditMock)
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

  it('verifica el correo, crea sesión y limpia el token', async () => {
    const user = makeUser()
    userFindOneMock.mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    })
    createLoginSessionMock.mockResolvedValue('session-jwt')

    const { default: handler } = await import('~~/server/api/auth/verify-email.post')

    const result = await handler({
      body: { token: 'valid-token' },
    } as never)

    expect(enforceAuthRateLimitMock).toHaveBeenCalledWith(expect.anything(), 'auth:verify-email')
    expect(user.emailVerifiedAt).toBeInstanceOf(Date)
    expect(user.emailVerifyToken).toBeUndefined()
    expect(user.emailVerifyExpires).toBeUndefined()
    expect(user.save).toHaveBeenCalled()
    expect(createLoginSessionMock).toHaveBeenCalledWith(expect.anything(), user)
    expect(result).toEqual({
      success: true,
      data: { token: 'session-jwt', user: { id: 'user-id', fullName: 'Ada Lovelace' } },
    })
  })

  it('rechaza el token si no existe', async () => {
    userFindOneMock.mockReturnValue({ select: vi.fn().mockResolvedValue(null) })

    const { default: handler } = await import('~~/server/api/auth/verify-email.post')

    await expect(handler({ body: { token: 'missing' } } as never)).rejects.toMatchObject({
      statusCode: 401,
    })
    expect(createLoginSessionMock).not.toHaveBeenCalled()
  })

  it('rechaza el token expirado', async () => {
    const expiredUser = makeUser({
      emailVerifyExpires: new Date(Date.now() - 1_000),
    })
    userFindOneMock.mockReturnValue({
      select: vi.fn().mockResolvedValue(expiredUser),
    })

    const { default: handler } = await import('~~/server/api/auth/verify-email.post')

    await expect(handler({ body: { token: 'valid-token' } } as never)).rejects.toMatchObject({
      statusCode: 401,
    })
    expect(expiredUser.save).not.toHaveBeenCalled()
  })

  it('rechaza payload inválido', async () => {
    const { default: handler } = await import('~~/server/api/auth/verify-email.post')

    await expect(handler({ body: { token: '' } } as never)).rejects.toMatchObject({
      statusCode: 400,
    })
  })
})
