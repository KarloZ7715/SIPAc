import { describe, expect, it } from 'vitest'
import {
  dedupeEvidenceSnippetsForDisplay,
  formatChatProductType,
  formatChatSearchStrategy,
  isDuplicateChatToolPart,
} from '~~/app/utils/chat-formatters'
import type { ChatUiMessage } from '~~/app/types'

describe('chat-formatters', () => {
  it('formatChatProductType traduce tipos conocidos', () => {
    expect(formatChatProductType('thesis')).toBe('Tesis')
    expect(formatChatProductType('article')).toBe('Artículo')
  })

  it('formatChatSearchStrategy traduce estrategias', () => {
    expect(formatChatSearchStrategy('structured_exact')).toBe('Coincidencia exacta')
    expect(formatChatSearchStrategy('diagnostic_broadened')).toBe('Búsqueda ampliada')
  })

  it('dedupeEvidenceSnippetsForDisplay colapsa misma etiqueta y texto', () => {
    const rows = dedupeEvidenceSnippetsForDisplay(
      [
        { source: 'metadata', field: 'manualMetadata.institution', text: 'Universidad de Córdoba' },
        {
          source: 'metadata',
          field: 'extractedEntities.institution.value',
          text: 'Universidad de Córdoba',
        },
        { source: 'metadata', field: 'manualMetadata.institution', text: 'Otra' },
      ],
      3,
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.label).toBe('Institución')
    expect(rows[0]?.text).toBe('Universidad de Córdoba')
    expect(rows[1]?.text).toBe('Otra')
  })

  it('isDuplicateChatToolPart detecta duplicados por toolCallKey', () => {
    const toolOut = {
      filters: {},
      normalizedFilters: {},
      total: 1,
      limitedTo: 5,
      strategyUsed: 'structured_exact' as const,
      matchedFields: [],
      evidenceSnippets: [],
      toolCallKey: 'same-key',
      results: [],
    }
    const message = {
      id: 'm1',
      role: 'assistant' as const,
      parts: [
        {
          type: 'tool-searchRepositoryProducts' as const,
          state: 'output-available' as const,
          output: toolOut,
        },
        {
          type: 'tool-searchRepositoryProducts' as const,
          state: 'output-available' as const,
          output: { ...toolOut },
        },
      ],
    } satisfies ChatUiMessage

    expect(isDuplicateChatToolPart(message, 0)).toBe(false)
    expect(isDuplicateChatToolPart(message, 1)).toBe(true)
  })
})
