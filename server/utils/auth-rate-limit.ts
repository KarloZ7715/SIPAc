import { getRequestIP, setHeader } from 'h3'
import type { H3Event } from 'h3'
import { createRateLimitError } from './errors'

interface AuthRateLimitBucket {
  count: number
  resetAt: number
}

const authRateLimitBuckets = new Map<string, AuthRateLimitBucket>()

function getClientKey(event: H3Event, scope: string) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  return `${scope}:${ip}`
}

export function resetAuthRateLimitBuckets() {
  authRateLimitBuckets.clear()
}

export function enforceAuthRateLimit(
  event: H3Event,
  scope = 'auth',
  maxRequests = 10,
  intervalMs = 60_000,
) {
  const key = getClientKey(event, scope)
  const now = Date.now()
  const current = authRateLimitBuckets.get(key)

  if (!current || current.resetAt <= now) {
    authRateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + intervalMs,
    })

    setHeader(event, 'X-RateLimit-Limit', maxRequests)
    setHeader(event, 'X-RateLimit-Remaining', Math.max(0, maxRequests - 1))
    return
  }

  current.count += 1
  authRateLimitBuckets.set(key, current)

  const remaining = Math.max(0, maxRequests - current.count)
  setHeader(event, 'X-RateLimit-Limit', maxRequests)
  setHeader(event, 'X-RateLimit-Remaining', remaining)

  if (current.count > maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    setHeader(event, 'Retry-After', retryAfterSeconds)
    throw createRateLimitError(retryAfterSeconds)
  }
}
