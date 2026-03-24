import { setHeader } from 'h3'
import type { H3Event } from 'h3'
import { createRateLimitError } from './errors'

interface ChatRateLimitBucket {
  count: number
  resetAt: number
}

const chatRateLimitBuckets = new Map<string, ChatRateLimitBucket>()

export function resetChatRateLimitBuckets() {
  chatRateLimitBuckets.clear()
}

export function enforceChatRateLimit(
  event: H3Event,
  userId: string,
  scope = 'chat',
  maxRequests = 30,
  intervalMs = 60 * 60 * 1000,
) {
  const key = `${scope}:${userId}`
  const now = Date.now()
  const current = chatRateLimitBuckets.get(key)

  if (!current || current.resetAt <= now) {
    chatRateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + intervalMs,
    })

    setHeader(event, 'X-RateLimit-Limit', maxRequests)
    setHeader(event, 'X-RateLimit-Remaining', Math.max(0, maxRequests - 1))
    return
  }

  current.count += 1
  chatRateLimitBuckets.set(key, current)

  const remaining = Math.max(0, maxRequests - current.count)
  setHeader(event, 'X-RateLimit-Limit', maxRequests)
  setHeader(event, 'X-RateLimit-Remaining', remaining)

  if (current.count > maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    setHeader(event, 'Retry-After', retryAfterSeconds)
    throw createRateLimitError(retryAfterSeconds)
  }
}
