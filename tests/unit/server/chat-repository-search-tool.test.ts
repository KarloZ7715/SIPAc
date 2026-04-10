import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatSearchToolOutput } from '~~/app/types'

const { executeGroundedRepositoryRetrievalMock } = vi.hoisted(() => ({
  executeGroundedRepositoryRetrievalMock: vi.fn(),
}))

vi.mock('~~/server/services/chat/grounded-repository-retrieval', () => ({
  executeGroundedRepositoryRetrieval: executeGroundedRepositoryRetrievalMock,
}))

describe('createRepositorySearchToolExecutor', () => {
  beforeEach(() => {
    executeGroundedRepositoryRetrievalMock.mockReset()
  })

  it('deduplica llamadas idénticas dentro del turno', async () => {
    const output: ChatSearchToolOutput = {
      filters: { search: 'ia' },
      normalizedFilters: { search: 'ia' },
      total: 1,
      limitedTo: 6,
      strategyUsed: 'structured_exact',
      matchedFields: [],
      evidenceSnippets: [],
      toolCallKey: '{"search":"ia"}',
      results: [],
    }

    executeGroundedRepositoryRetrievalMock.mockResolvedValue(output)

    const { createRepositorySearchToolExecutor } =
      await import('../../../server/services/chat/repository-search-tool')

    const execute = createRepositorySearchToolExecutor()
    const first = await execute({ question: 'Busca IA', search: 'ia' })
    const second = await execute({ question: 'Busca IA', search: 'ia' })

    expect(first.deduplicated).toBeUndefined()
    expect(second.deduplicated).toBe(true)
    expect(executeGroundedRepositoryRetrievalMock).toHaveBeenCalledTimes(2)
  })

  it('no reutiliza cache cuando cambia la pregunta aunque los filtros normalizados coincidan', async () => {
    executeGroundedRepositoryRetrievalMock
      .mockResolvedValueOnce({
        filters: { institution: 'Universidad de Córdoba' },
        normalizedFilters: { institution: 'Universidad de Córdoba' },
        total: 0,
        limitedTo: 6,
        strategyUsed: 'structured_exact',
        matchedFields: [],
        evidenceSnippets: [],
        toolCallKey: '{"institution":"Universidad de Córdoba"}',
        results: [],
      })
      .mockResolvedValueOnce({
        filters: { institution: 'Universidad de Córdoba' },
        normalizedFilters: { institution: 'Universidad de Córdoba' },
        total: 1,
        limitedTo: 6,
        strategyUsed: 'diagnostic_broadened',
        matchedFields: [],
        evidenceSnippets: [],
        toolCallKey: '{"institution":"Universidad de Córdoba"}',
        results: [],
      })

    const { createRepositorySearchToolExecutor } =
      await import('../../../server/services/chat/repository-search-tool')

    const execute = createRepositorySearchToolExecutor()
    const first = await execute({
      question: '¿Qué certificados hay en la Universidad de Córdoba?',
      institution: 'Universidad de Córdoba',
    })
    const second = await execute({
      question:
        '¿Qué certificados hay en la Universidad de Córdoba? Si no hay, muéstrame relacionados.',
      institution: 'Universidad de Córdoba',
    })

    expect(first.total).toBe(0)
    expect(second.total).toBe(1)
    expect(second.deduplicated).toBeUndefined()
  })

  it('usa lenguaje de repositorio compartido en el prompt del sistema', async () => {
    const { buildChatSystemPrompt } =
      await import('../../../server/services/chat/repository-search-tool')

    const prompt = buildChatSystemPrompt()

    expect(prompt).toContain('repositorio compartido de SIPAc')
    expect(prompt).not.toContain('el usuario ya tiene cargados')
  })
})
