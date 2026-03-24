import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { userFindByIdMock, productAggregateMock, countDocumentsMock, productsFindMock } = vi.hoisted(
  () => ({
    userFindByIdMock: vi.fn(),
    productAggregateMock: vi.fn(),
    countDocumentsMock: vi.fn(),
    productsFindMock: vi.fn(),
  }),
)

vi.mock('~~/server/models/User', () => ({
  default: {
    findById: userFindByIdMock,
  },
}))

vi.mock('~~/server/models/AcademicProduct', () => ({
  default: {
    aggregate: productAggregateMock,
    countDocuments: countDocumentsMock,
    find: productsFindMock,
  },
}))

describe('GET /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('requireAuth', (event: { context?: { auth?: unknown } }) => event.context?.auth)
    vi.stubGlobal('createAuthenticationError', () => {
      const error = new Error('Unauthorized')
      Object.assign(error, { statusCode: 401 })
      return error
    })
    vi.stubGlobal('createNotFoundError', (resource: string) => {
      const error = new Error(`${resource} not found`)
      Object.assign(error, { statusCode: 404 })
      return error
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('devuelve resumen agregado de productos confirmados y borradores recientes', async () => {
    userFindByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        fullName: 'Ada Lovelace',
        email: 'ada@demo.test',
        role: 'docente',
        isActive: true,
        program: 'Maestría',
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
      }),
    })

    productAggregateMock.mockResolvedValueOnce([{ _id: 'article', total: 2 }])
    countDocumentsMock.mockResolvedValueOnce(2)
    productsFindMock.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: { toString: () => '507f191e810c19729de860ea' },
          productType: 'article',
          reviewStatus: 'draft',
          updatedAt: new Date('2026-03-23T12:00:00.000Z'),
          manualMetadata: { title: 'Borrador vigente' },
          extractedEntities: {},
        },
      ]),
    })

    const { default: profileEndpoint } = await import('~~/server/api/profile/index.get')

    const result = await profileEndpoint({
      context: {
        auth: {
          sub: '507f1f77bcf86cd799439011',
        },
      },
    } as never)

    expect(result.success).toBe(true)
    expect(result.data.totalOwnProducts).toBe(2)
    expect(result.data.productSummaryByType).toEqual([{ productType: 'article', total: 2 }])
    expect(result.data.latestDrafts[0]?.title).toBe('Borrador vigente')
  })
})
