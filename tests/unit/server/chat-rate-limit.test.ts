import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enforceChatRateLimit, resetChatRateLimitBuckets } from '~~/server/utils/chat-rate-limit'

const { setHeaderMock } = vi.hoisted(() => ({
  setHeaderMock: vi.fn(),
}))

const { rateLimitBucketModelMock } = vi.hoisted(() => ({
  rateLimitBucketModelMock: {
    findOneAndUpdate: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    setHeader: setHeaderMock,
  }
})

vi.mock('~~/server/models/ChatRateLimitBucket', () => ({
  default: rateLimitBucketModelMock,
}))

describe('chat-rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-23T10:00:00.000Z'))
    setHeaderMock.mockReset()
    rateLimitBucketModelMock.findOneAndUpdate.mockReset()
    rateLimitBucketModelMock.deleteMany.mockResolvedValue({ acknowledged: true })
  })

  afterEach(async () => {
    vi.useRealTimers()
    await resetChatRateLimitBuckets()
  })

  it('permite solicitudes dentro de la ventana y bloquea el exceso', async () => {
    const event = {} as never
    rateLimitBucketModelMock.findOneAndUpdate
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 3 })

    await expect(enforceChatRateLimit(event, 'user-1', 'chat', 2, 60_000)).resolves.toBeUndefined()
    await expect(enforceChatRateLimit(event, 'user-1', 'chat', 2, 60_000)).resolves.toBeUndefined()

    await expect(enforceChatRateLimit(event, 'user-1', 'chat', 2, 60_000)).rejects.toMatchObject({
      statusCode: 429,
    })

    expect(setHeaderMock).toHaveBeenCalledWith(event, 'X-RateLimit-Limit', 2)
    expect(setHeaderMock).toHaveBeenCalledWith(event, 'X-RateLimit-Remaining', 0)
    expect(setHeaderMock).toHaveBeenCalledWith(event, 'Retry-After', 60)
  })

  it('reinicia el bucket al vencer la ventana', async () => {
    const event = {} as never
    rateLimitBucketModelMock.findOneAndUpdate
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })

    await enforceChatRateLimit(event, 'user-2', 'chat', 1, 60_000)
    vi.advanceTimersByTime(60_001)

    await expect(enforceChatRateLimit(event, 'user-2', 'chat', 1, 60_000)).resolves.toBeUndefined()
  })
})
