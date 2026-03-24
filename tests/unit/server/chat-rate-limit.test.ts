import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enforceChatRateLimit, resetChatRateLimitBuckets } from '~~/server/utils/chat-rate-limit'

const { setHeaderMock } = vi.hoisted(() => ({
  setHeaderMock: vi.fn(),
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    setHeader: setHeaderMock,
  }
})

describe('chat-rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-23T10:00:00.000Z'))
    setHeaderMock.mockReset()
    resetChatRateLimitBuckets()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetChatRateLimitBuckets()
  })

  it('permite solicitudes dentro de la ventana y bloquea el exceso', () => {
    const event = {} as never

    expect(() => enforceChatRateLimit(event, 'user-1', 'chat', 2, 60_000)).not.toThrow()
    expect(() => enforceChatRateLimit(event, 'user-1', 'chat', 2, 60_000)).not.toThrow()

    try {
      enforceChatRateLimit(event, 'user-1', 'chat', 2, 60_000)
      throw new Error('Expected rate limit error')
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 429 })
    }

    expect(setHeaderMock).toHaveBeenCalledWith(event, 'X-RateLimit-Limit', 2)
    expect(setHeaderMock).toHaveBeenCalledWith(event, 'X-RateLimit-Remaining', 0)
    expect(setHeaderMock).toHaveBeenCalledWith(event, 'Retry-After', 60)
  })

  it('reinicia el bucket al vencer la ventana', () => {
    const event = {} as never

    enforceChatRateLimit(event, 'user-2', 'chat', 1, 60_000)
    vi.advanceTimersByTime(60_001)

    expect(() => enforceChatRateLimit(event, 'user-2', 'chat', 1, 60_000)).not.toThrow()
  })
})
