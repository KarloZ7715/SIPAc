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
})
