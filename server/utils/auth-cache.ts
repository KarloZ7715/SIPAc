/**
 * In-memory LRU cache for auth middleware — avoids 2 MongoDB queries
 * per API request for already-validated sessions.
 *
 * TTL: 60 seconds — a revoked session can be used at most 60s more.
 * Max size: 500 entries — prevents unbounded memory growth.
 */

interface CachedAuth {
  session: { _id: unknown; revokedAt?: Date | null; expiresAt: Date }
  user: { tokenVersion?: number; isActive: boolean }
  cachedAt: number
}

const AUTH_CACHE_TTL_MS = 60_000
const AUTH_CACHE_MAX = 500
const authCache = new Map<string, CachedAuth>()

function getAuthCacheKey(jti: string, sub: string): string {
  return `${jti}:${sub}`
}

function pruneAuthCache(): void {
  if (authCache.size <= AUTH_CACHE_MAX) return
  const now = Date.now()
  for (const [key, val] of authCache) {
    if (now - val.cachedAt > AUTH_CACHE_TTL_MS) authCache.delete(key)
  }
}

export function getAuthCache(jti: string, sub: string): CachedAuth | undefined {
  const key = getAuthCacheKey(jti, sub)
  const entry = authCache.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.cachedAt > AUTH_CACHE_TTL_MS) {
    authCache.delete(key)
    return undefined
  }
  return entry
}

export function setAuthCache(
  jti: string,
  sub: string,
  session: CachedAuth['session'],
  user: CachedAuth['user'],
): void {
  pruneAuthCache()
  const key = getAuthCacheKey(jti, sub)
  authCache.set(key, { session, user, cachedAt: Date.now() })
}

/**
 * Invalidate a specific auth cache entry — call on logout, session revoke,
 * user deactivation, or password change.
 */
export function invalidateAuthCache(jti: string, sub: string): void {
  const key = getAuthCacheKey(jti, sub)
  authCache.delete(key)
}

/**
 * Invalidate ALL entries for a given user — useful for "revoke all sessions"
 * or user deactivation.
 */
export function invalidateAuthCacheForUser(sub: string): void {
  const suffix = `:${sub}`
  for (const key of authCache.keys()) {
    if (key.endsWith(suffix)) authCache.delete(key)
  }
}
