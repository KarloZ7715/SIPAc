import { beforeEach, describe, expect, it, vi } from 'vitest'
import { executeGroundedRepositoryRetrieval } from '~~/server/services/chat/grounded-repository-retrieval'

const { searchConfirmedRepositoryProductsMock } = vi.hoisted(() => ({
  searchConfirmedRepositoryProductsMock: vi.fn(),
}))

vi.mock('~~/server/services/products/confirmed-repository-search', () => ({
  CONFIRMED_REPOSITORY_AUTHOR_FIELDS: [],
  CONFIRMED_REPOSITORY_GENERIC_SEARCH_FIELDS: [],
  CONFIRMED_REPOSITORY_INSTITUTION_FIELDS: [],
  CONFIRMED_REPOSITORY_KEYWORD_FIELDS: [],
  CONFIRMED_REPOSITORY_TITLE_FIELDS: [],
  normalizeConfirmedRepositoryFilters: (filters: Record<string, unknown>) => filters,
  searchConfirmedRepositoryProducts: searchConfirmedRepositoryProductsMock,
}))

vi.mock('~~/server/models/UploadedFile', () => ({
  default: {
    find: vi.fn(() => ({
      lean: async () => [],
      limit: () => ({
        lean: async () => [],
      }),
    })),
  },
}))

vi.mock('~~/server/models/AcademicProduct', () => ({
  default: {
    find: vi.fn(() => ({
      limit: () => ({
        lean: async () => [],
      }),
    })),
  },
}))
describe('executeGroundedRepositoryRetrieval strict by intent', () => {
  beforeEach(() => {
    searchConfirmedRepositoryProductsMock.mockReset()
  })

  it('does not broaden to related results when user asks for a specific product type', async () => {
    searchConfirmedRepositoryProductsMock.mockResolvedValueOnce({
      total: 0,
      products: [],
    })

    const output = await executeGroundedRepositoryRetrieval({
      question: '¿Qué certificados confirmados están asociados a la Universidad de Córdoba?',
      productType: 'certificate',
      institution: 'Universidad de Córdoba',
    })

    expect(searchConfirmedRepositoryProductsMock).toHaveBeenCalledTimes(1)
    expect(output.total).toBe(0)
    expect(output.strategyUsed).toBe('structured_exact')
    expect(output.diagnosticInfo?.broadened).toBe(false)
  })

  it('allows broadening when user explicitly asks for related results if no exact matches exist', async () => {
    searchConfirmedRepositoryProductsMock
      .mockResolvedValueOnce({ total: 0, products: [] })
      .mockResolvedValueOnce({ total: 0, products: [] })

    const output = await executeGroundedRepositoryRetrieval({
      question:
        '¿Qué certificados confirmados están asociados a la Universidad de Córdoba? Si no hay, muéstrame relacionados.',
      productType: 'certificate',
      institution: 'Universidad de Córdoba',
    })

    expect(searchConfirmedRepositoryProductsMock).toHaveBeenCalledTimes(2)
    expect(output.total).toBe(0)
    expect(output.diagnosticInfo?.broadened).toBe(true)
  })

  it('keeps broadened results when they match requested year range even without text field matches', async () => {
    searchConfirmedRepositoryProductsMock
      .mockResolvedValueOnce({ total: 0, products: [] })
      .mockResolvedValueOnce({
        total: 1,
        products: [
          {
            _id: 'prod-1',
            productType: 'article',
            owner: 'user-1',
            sourceFile: 'file-1',
            reviewStatus: 'confirmed',
            manualMetadata: {
              title: 'Documento sin coincidencia textual directa',
              authors: ['Autor Distinto'],
              institution: 'Otra institución',
              date: '2024-05-20T00:00:00.000Z',
              keywords: [],
            },
          },
        ],
      })

    const output = await executeGroundedRepositoryRetrieval({
      question:
        '¿Qué certificados confirmados están asociados a la Universidad de Córdoba? Si no hay, muéstrame relacionados.',
      productType: 'certificate',
      institution: 'Universidad de Córdoba',
      yearFrom: 2024,
      yearTo: 2024,
    })

    expect(searchConfirmedRepositoryProductsMock).toHaveBeenCalledTimes(2)
    expect(output.total).toBe(1)
    expect(output.strategyUsed).toBe('diagnostic_broadened')
    expect(output.diagnosticInfo?.broadened).toBe(true)
  })

  it('keeps broadened results when dateTo is the same day as referenceDate with later time', async () => {
    searchConfirmedRepositoryProductsMock
      .mockResolvedValueOnce({ total: 0, products: [] })
      .mockResolvedValueOnce({
        total: 1,
        products: [
          {
            _id: 'prod-2',
            productType: 'article',
            owner: 'user-1',
            sourceFile: 'file-2',
            reviewStatus: 'confirmed',
            manualMetadata: {
              title: 'Documento con fecha al final del dia',
              authors: ['Autor Distinto'],
              institution: 'Otra institución',
              date: '2024-05-20T20:30:00.000Z',
              keywords: [],
            },
          },
        ],
      })

    const output = await executeGroundedRepositoryRetrieval({
      question:
        '¿Qué certificados confirmados están asociados a la Universidad de Córdoba? Si no hay, muéstrame relacionados.',
      productType: 'certificate',
      institution: 'Universidad de Córdoba',
      dateFrom: '2024-05-20',
      dateTo: '2024-05-20',
    })

    expect(searchConfirmedRepositoryProductsMock).toHaveBeenCalledTimes(2)
    expect(output.total).toBe(1)
    expect(output.strategyUsed).toBe('diagnostic_broadened')
  })

  it('does not keep broadened results when date filters are invalid', async () => {
    searchConfirmedRepositoryProductsMock
      .mockResolvedValueOnce({ total: 0, products: [] })
      .mockResolvedValueOnce({
        total: 1,
        products: [
          {
            _id: 'prod-3',
            productType: 'article',
            owner: 'user-1',
            sourceFile: 'file-3',
            reviewStatus: 'confirmed',
            manualMetadata: {
              title: 'Documento candidato por ampliacion',
              authors: ['Autor Distinto'],
              institution: 'Otra institución',
              date: '2024-05-20T10:30:00.000Z',
              keywords: [],
            },
          },
        ],
      })

    const output = await executeGroundedRepositoryRetrieval({
      question:
        '¿Qué certificados confirmados están asociados a la Universidad de Córdoba? Si no hay, muéstrame relacionados.',
      productType: 'certificate',
      institution: 'Universidad de Córdoba',
      dateFrom: 'fecha-invalida',
      dateTo: '2024-05-20',
    })

    expect(searchConfirmedRepositoryProductsMock).toHaveBeenCalledTimes(2)
    expect(output.total).toBe(0)
    expect(output.strategyUsed).toBe('diagnostic_broadened')
  })
})
