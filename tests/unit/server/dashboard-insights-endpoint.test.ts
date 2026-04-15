import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const productAggregateMock = vi.fn()
const productFindMock = vi.fn()

vi.mock('~~/server/models/AcademicProduct', () => ({
  default: {
    aggregate: productAggregateMock,
    find: productFindMock,
  },
}))

describe('GET /api/dashboard/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('requireAuth', () => ({ sub: '507f191e810c19729de860ea', role: 'docente' }))
    vi.stubGlobal('getQuery', () => ({}))
    vi.stubGlobal('createAuthenticationError', () => {
      const error = new Error('Unauthorized')
      Object.assign(error, { statusCode: 401 })
      return error
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('devuelve onboarding cuando el total filtrado es 0', async () => {
    productAggregateMock.mockResolvedValueOnce([{ n: 0 }])

    const { default: handler } = await import('~~/server/api/dashboard/insights.get')
    const result = await (handler as (e: unknown) => Promise<{ data: unknown }>)({})

    expect(result.data).toEqual([
      expect.objectContaining({
        id: 'onboarding-empty',
        severity: 'info',
        title: 'Empieza tu línea base',
        secondaryHref: '/repository',
        secondaryCtaLabel: 'Ver repositorio',
      }),
    ])
    expect(productFindMock).not.toHaveBeenCalled()
  })

  it('agrega facetas y heurística de congreso cuando hay productos', async () => {
    productAggregateMock
      .mockResolvedValueOnce([{ n: 2 }])
      .mockResolvedValueOnce([
        {
          lowCount: [{ n: 1 }],
          lowFirst: [{ _id: '507f191e810c19729de860e1' }],
        },
      ])
      .mockResolvedValueOnce([
        {
          doiCount: [{ n: 0 }],
          doiFirst: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          highCount: [{ n: 2 }],
          highFirst: [{ _id: '507f191e810c19729de860e2' }],
        },
      ])
      .mockResolvedValueOnce([
        {
          thesisCount: [{ n: 0 }],
          thesisFirst: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          softwareCount: [{ n: 0 }],
          softwareFirst: [],
        },
      ])

    productFindMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    })

    const { default: handler } = await import('~~/server/api/dashboard/insights.get')
    const result = await (handler as (e: unknown) => Promise<{ data: unknown }>)({})

    const rows = result.data as Array<{ id: string; href: string }>
    expect(rows.some((r) => r.id === 'low-confidence-ner')).toBe(true)
    expect(rows.some((r) => r.id === 'high-ner-quality')).toBe(true)
    const low = rows.find((r) => r.id === 'low-confidence-ner')
    expect(low?.href).toContain('fromInsight=low-confidence-ner')
    expect(productAggregateMock).toHaveBeenCalled()
    expect(productFindMock).toHaveBeenCalled()
  })

  it('enlaza tesis sin repo con focus=repositoryUrl', async () => {
    const thesisId = '507f191e810c19729de860e3'
    productAggregateMock
      .mockResolvedValueOnce([{ n: 2 }])
      .mockResolvedValueOnce([
        {
          lowCount: [{ n: 0 }],
          lowFirst: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          doiCount: [{ n: 0 }],
          doiFirst: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          highCount: [{ n: 0 }],
          highFirst: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          thesisCount: [{ n: 1 }],
          thesisFirst: [{ _id: thesisId }],
        },
      ])
      .mockResolvedValueOnce([
        {
          softwareCount: [{ n: 0 }],
          softwareFirst: [],
        },
      ])

    productFindMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    })

    const { default: handler } = await import('~~/server/api/dashboard/insights.get')
    const result = await (handler as (e: unknown) => Promise<{ data: unknown }>)({})

    const rows = result.data as Array<{ id: string; href: string }>
    const thesisRow = rows.find((r) => r.id === 'thesis-missing-repository-url')
    expect(thesisRow).toBeDefined()
    expect(thesisRow!.href).toContain(`productId=${thesisId}`)
    expect(thesisRow!.href).toContain('focus=repositoryUrl')
  })
})
