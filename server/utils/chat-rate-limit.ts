import { setHeader } from 'h3'
import type { H3Event } from 'h3'
import ChatRateLimitBucket from '~~/server/models/ChatRateLimitBucket'
import { createRateLimitError } from './errors'

function resolveRateLimitWindow(now: number, intervalMs: number) {
  const windowStartedAt = now - (now % intervalMs)
  const resetAt = windowStartedAt + intervalMs

  return {
    bucketId: `${windowStartedAt}`,
    windowStartedAt,
    resetAt,
  }
}

export async function resetChatRateLimitBuckets() {
  await ChatRateLimitBucket.deleteMany({})
}

export async function enforceChatRateLimit(
  event: H3Event,
  userId: string,
  scope = 'chat',
  maxRequests = 30,
  intervalMs = 60 * 60 * 1000,
) {
  const now = Date.now()
  const { bucketId, resetAt, windowStartedAt } = resolveRateLimitWindow(now, intervalMs)
  const current = await ChatRateLimitBucket.findOneAndUpdate(
    {
      _id: `${scope}:${userId}:${bucketId}`,
    },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        scope,
        userId,
        windowStartedAt: new Date(windowStartedAt),
        expiresAt: new Date(resetAt),
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    },
  )

  const currentCount = typeof current?.count === 'number' ? current.count : 1
  const remaining = Math.max(0, maxRequests - currentCount)
  setHeader(event, 'X-RateLimit-Limit', maxRequests)
  setHeader(event, 'X-RateLimit-Remaining', remaining)

  if (currentCount > maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000))
    setHeader(event, 'Retry-After', retryAfterSeconds)
    throw createRateLimitError(retryAfterSeconds)
  }
}
