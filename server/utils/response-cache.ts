/**
 * Lightweight in-memory response cache for semi-static API endpoints.
 *
 * Use for endpoints that rarely change and can tolerate stale data
 * for a few minutes (e.g. Google OAuth status, NER metrics summary).
 */

const cache = new Map<string, { data: unknown; expiresAt: number }>()

/**
 * Returns cached data if still fresh, otherwise calls the fetcher,
 * caches the result, and returns it.
 */
export function cachedResponse<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expiresAt) return Promise.resolve(cached.data as T)
  return fetcher().then((data) => {
    cache.set(key, { data, expiresAt: Date.now() + ttlMs })
    return data
  })
}

/** Manually invalidate a cache entry. */
export function invalidateResponseCache(key: string): void {
  cache.delete(key)
}
