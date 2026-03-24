import { describe, expect, it } from 'vitest'
import { tool, validateUIMessages } from 'ai'
import { z } from 'zod'
import type { ChatUiMessage } from '~~/app/types'

describe('chat message validation', () => {
  it('accepts persisted assistant tool parts without requiring data-* parts', async () => {
    const tools = {
      searchRepositoryProducts: tool({
        inputSchema: z.object({
          question: z.string(),
          institution: z.string().optional(),
          productType: z.string().optional(),
        }),
        execute: async () => ({
          filters: {
            institution: 'Universidad de Córdoba',
            productType: 'thesis',
            limit: 6,
          },
          total: 0,
          limitedTo: 6,
          results: [],
        }),
      }),
    }

    const messages = [
      {
        id: 'user-1',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: '¿Qué tesis confirmadas están asociadas a la Universidad de Córdoba?',
          },
        ],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        metadata: {
          createdAt: Date.now(),
          provider: 'cerebras',
          model: 'qwen-3-235b-a22b-instruct-2507',
          finishReason: 'stop',
          totalTokens: 1386,
        },
        parts: [
          { type: 'step-start' },
          {
            type: 'tool-searchRepositoryProducts',
            toolCallId: 'tool-1',
            state: 'output-available',
            input: {
              question: 'Tesis confirmadas asociadas a la Universidad de Córdoba',
              institution: 'Universidad de Córdoba',
              productType: 'thesis',
            },
            output: {
              filters: {
                institution: 'Universidad de Córdoba',
                productType: 'thesis',
                limit: 6,
              },
              total: 0,
              limitedTo: 6,
              results: [],
            },
          },
          { type: 'step-start' },
          {
            type: 'text',
            text: 'No se encontraron tesis confirmadas asociadas a la Universidad de Córdoba.',
            state: 'done',
          },
        ],
      },
      {
        id: 'user-2',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: '¿Qué tesis confirmadas están asociadas a la Universidad de Córdoba?',
          },
        ],
      },
    ]

    const result = await validateUIMessages<ChatUiMessage>({
      messages,
      tools,
    })

    expect(result).toHaveLength(3)
    expect(result[1]?.parts[1]?.type).toBe('tool-searchRepositoryProducts')
    expect(result[1]?.parts[3]?.type).toBe('text')
  })
})
