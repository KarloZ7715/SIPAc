import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enforceAuthRateLimit, resetAuthRateLimitBuckets } from '~~/server/utils/auth-rate-limit'

const { setHeaderMock } = vi.hoisted(() => ({
  setHeaderMock: vi.fn(),
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    getRequestIP: vi.fn(() => '127.0.0.1'),
    setHeader: setHeaderMock,
  }
})

describe('auth-rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-23T10:00:00.000Z'))
    setHeaderMock.mockReset()
    resetAuthRateLimitBuckets()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetAuthRateLimitBuckets()
  })

  it('permite hasta 10 intentos por ventana y bloquea el siguiente', () => {
    const event = {} as never

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(() => enforceAuthRateLimit(event, 'auth:login')).not.toThrow()
    }

    try {
      enforceAuthRateLimit(event, 'auth:login')
      throw new Error('Expected rate limit error')
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 429 })
    }

    expect(setHeaderMock).toHaveBeenCalledWith(event, 'X-RateLimit-Limit', 10)
    expect(setHeaderMock).toHaveBeenCalledWith(event, 'Retry-After', 60)
  })

  it('reinicia el contador cuando vence la ventana', () => {
    const event = {} as never

    for (let attempt = 0; attempt < 10; attempt += 1) {
      enforceAuthRateLimit(event, 'auth:register')
    }

    vi.advanceTimersByTime(60_001)

    expect(() => enforceAuthRateLimit(event, 'auth:register')).not.toThrow()
  })
})
