import { describe, expect, it } from 'vitest'
import type { ChatUiMessage } from '~~/app/types'
import {
  computeChatLastMessageAtIso,
  sanitizeChatMessages,
} from '~~/server/services/chat/conversations'

describe('computeChatLastMessageAtIso', () => {
  it('usa el mayor metadata.createdAt de los mensajes', () => {
    const messages = [
      {
        id: 'a',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Hola' }],
        metadata: { createdAt: 1_700_000_000_000 },
      },
      {
        id: 'b',
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: 'Respuesta' }],
        metadata: { createdAt: 1_800_000_000_000 },
      },
    ] as ChatUiMessage[]

    const iso = computeChatLastMessageAtIso(
      messages,
      '2026-01-01T00:00:00.000Z',
      '2025-12-01T00:00:00.000Z',
    )
    expect(iso).toBe(new Date(1_800_000_000_000).toISOString())
  })

  it('sin timestamps en mensajes pero con mensajes usa updatedAt', () => {
    const messages = [
      {
        id: 'a',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Hola' }],
      },
    ] as ChatUiMessage[]

    expect(
      computeChatLastMessageAtIso(messages, '2026-03-23T10:05:00.000Z', '2026-03-23T10:00:00.000Z'),
    ).toBe('2026-03-23T10:05:00.000Z')
  })

  it('sin mensajes usa createdAt', () => {
    expect(
      computeChatLastMessageAtIso([], '2026-03-23T10:05:00.000Z', '2026-03-23T10:00:00.000Z'),
    ).toBe('2026-03-23T10:00:00.000Z')
  })
})

describe('chat conversation sanitization', () => {
  it('elimina mensajes vacíos y usuarios consecutivos con el mismo id', () => {
    const messages = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Muéstrame artículos sobre IA' }],
      },
      {
        id: 'assistant-empty',
        role: 'assistant',
        parts: [],
        metadata: {
          provider: 'cerebras',
          model: 'qwen-3-235b-a22b-instruct-2507',
        },
      },
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Muéstrame artículos sobre IA' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Encontré 3 resultados.' }],
      },
    ] as ChatUiMessage[]

    expect(sanitizeChatMessages(messages).map((message) => message.id)).toEqual([
      'user-1',
      'assistant-1',
    ])
  })

  it('conserva reintentos legítimos con el mismo texto pero distinto id', () => {
    const messages = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Muéstrame artículos sobre IA' }],
      },
      {
        id: 'user-2',
        role: 'user',
        parts: [{ type: 'text', text: 'Muéstrame artículos sobre IA' }],
      },
    ] as ChatUiMessage[]

    expect(sanitizeChatMessages(messages).map((message) => message.id)).toEqual([
      'user-1',
      'user-2',
    ])
  })
})
