import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reextractMock = vi.fn()

vi.mock('~~/server/utils/auth-rate-limit', () => ({
  enforceAuthRateLimit: vi.fn(),
  resetAuthRateLimitBuckets: vi.fn(),
}))

vi.mock('~~/server/services/products/reextract-product-ner', () => ({
  reextractProductNer: (...args: unknown[]) => reextractMock(...args),
}))

describe('POST /api/products/[id]/reextract-ner', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('requireAuth', () => ({ sub: '507f191e810c19729de860ea', role: 'docente' }))
    vi.stubGlobal('getRouterParam', (_event: unknown, key: string) =>
      key === 'id' ? '507f191e810c19729de860ea' : undefined,
    )
    reextractMock.mockResolvedValue({ extractionConfidence: 0.91 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('invoca el servicio y devuelve ok', async () => {
    const { default: handler } = await import('~~/server/api/products/[id]/reextract-ner.post')
    const result = await (handler as (e: unknown) => Promise<{ data: unknown }>)({})

    expect(reextractMock).toHaveBeenCalledWith({
      productId: '507f191e810c19729de860ea',
      userId: '507f191e810c19729de860ea',
      isAdmin: false,
    })
    expect(result.data).toEqual({ extractionConfidence: 0.91 })
  })
})
