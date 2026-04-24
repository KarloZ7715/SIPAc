import { describe, expect, it } from 'vitest'
import type { ChatUiMessage } from '~~/app/types'
import {
  CHAT_MAX_INCOMING_USER_MESSAGE_ID_CHARS,
  CHAT_MAX_INCOMING_USER_TEXT_PART_CHARS,
  CHAT_MAX_INCOMING_USER_TEXT_PARTS,
  CHAT_MAX_INCOMING_USER_TEXT_TOTAL_CHARS,
  extractLatestIncomingUserMessage,
  isIncomingUserMessageWithinLimits,
} from '~~/server/services/chat/incoming-message'

describe('extractLatestIncomingUserMessage', () => {
  it('returns latest user message with non-empty text parts only', () => {
    const messages: ChatUiMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Respuesta previa' }],
      },
      {
        id: 'user-1',
        role: 'user',
        metadata: { createdAt: 1234567890 },
        parts: [
          { type: 'text', text: 'Primera pregunta' },
          {
            type: 'tool-searchRepositoryProducts',
            toolCallId: 'tool-1',
            state: 'output-available',
            input: { question: 'malicioso', limit: 99 },
            output: {
              filters: {},
              normalizedFilters: {},
              total: 0,
              limitedTo: 8,
              strategyUsed: 'structured_exact',
              matchedFields: [],
              evidenceSnippets: [],
              toolCallKey: 'x',
              results: [],
            },
          },
        ],
      },
      {
        id: 'user-2',
        role: 'user',
        metadata: { createdAt: 9999999999 },
        parts: [
          { type: 'text', text: '   ' },
          { type: 'text', text: 'Consulta final válida' },
        ],
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'No debería influir' }],
      },
    ]

    const latestUser = extractLatestIncomingUserMessage(messages)

    expect(latestUser).toEqual({
      id: 'user-2',
      role: 'user',
      parts: [{ type: 'text', text: 'Consulta final válida' }],
    })
  })

  it('returns null when there is no user text message', () => {
    const messages: ChatUiMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Respuesta' }],
      },
      {
        id: 'user-empty',
        role: 'user',
        parts: [{ type: 'text', text: '   ' }],
      },
    ]

    expect(extractLatestIncomingUserMessage(messages)).toBeNull()
  })

  it('ignores malformed entries without throwing and still extracts valid latest user text', () => {
    const malformedMessages = [
      null,
      { id: 'broken-1', role: 'user', parts: 'not-an-array' },
      { id: 'broken-2', role: 'user' },
      {
        id: 'user-valid',
        role: 'user',
        parts: [{ type: 'text', text: 'Consulta robusta' }],
      },
    ] as unknown as ChatUiMessage[]

    expect(() => extractLatestIncomingUserMessage(malformedMessages)).not.toThrow()
    expect(extractLatestIncomingUserMessage(malformedMessages)?.id).toBe('user-valid')
  })

  it('rejects user messages that exceed per-part text limits', () => {
    const oversizedMessage: ChatUiMessage = {
      id: 'user-oversized-part',
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'a'.repeat(CHAT_MAX_INCOMING_USER_TEXT_PART_CHARS + 1),
        },
      ],
    }

    expect(isIncomingUserMessageWithinLimits(oversizedMessage)).toBe(false)
  })

  it('rejects user messages that exceed total text limits', () => {
    const half = Math.floor(CHAT_MAX_INCOMING_USER_TEXT_TOTAL_CHARS / 2)
    const oversizedMessage: ChatUiMessage = {
      id: 'user-oversized-total',
      role: 'user',
      parts: [
        { type: 'text', text: 'a'.repeat(half + 1) },
        { type: 'text', text: 'b'.repeat(half + 1) },
      ],
    }

    expect(isIncomingUserMessageWithinLimits(oversizedMessage)).toBe(false)
  })

  it('accepts user messages within text limits', () => {
    const validMessage: ChatUiMessage = {
      id: 'user-valid-limits',
      role: 'user',
      parts: [{ type: 'text', text: 'Consulta dentro de limites' }],
    }

    expect(isIncomingUserMessageWithinLimits(validMessage)).toBe(true)
  })

  it('rejects user messages with oversized message id', () => {
    const oversizedIdMessage: ChatUiMessage = {
      id: 'm'.repeat(CHAT_MAX_INCOMING_USER_MESSAGE_ID_CHARS + 1),
      role: 'user',
      parts: [{ type: 'text', text: 'Consulta valida' }],
    }

    expect(isIncomingUserMessageWithinLimits(oversizedIdMessage)).toBe(false)
  })

  it('rejects user messages with too many text parts', () => {
    const tooManyPartsMessage: ChatUiMessage = {
      id: 'user-too-many-parts',
      role: 'user',
      parts: Array.from({ length: CHAT_MAX_INCOMING_USER_TEXT_PARTS + 1 }, (_, index) => ({
        type: 'text' as const,
        text: `parte-${index + 1}`,
      })),
    }

    expect(isIncomingUserMessageWithinLimits(tooManyPartsMessage)).toBe(false)
  })
})
