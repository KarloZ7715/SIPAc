import { describe, expect, it } from 'vitest'
import type { ChatUiMessage } from '~~/app/types'
import {
  computeChatLastMessageAtIso,
  sanitizeChatMessages,
  toChatConversationPublic,
  toChatConversationSummaryPublic,
  truncateChatMessagesForPersistence,
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

  it('drops assistant message with empty text when tool part has no output available', () => {
    const messages = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Busca tesis de 2024' }],
      },
      {
        id: 'assistant-empty-tool',
        role: 'assistant',
        parts: [
          { type: 'text', text: '   ' },
          {
            type: 'tool-searchRepositoryProducts',
            toolCallId: 'tool-1',
            state: 'input-available',
            input: {
              question: 'Busca tesis de 2024',
            },
          },
        ],
      },
      {
        id: 'user-2',
        role: 'user',
        parts: [{ type: 'text', text: 'Ahora busca articulos' }],
      },
    ] as ChatUiMessage[]

    const sanitized = sanitizeChatMessages(messages)

    expect(sanitized.map((message) => message.id)).toEqual(['user-1', 'user-2'])
    expect(sanitized.some((message) => message.role === 'assistant')).toBe(false)
  })

  it('toChatConversationPublic preserves persisted messages without re-sanitizing on read', () => {
    const persistedMessages = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Consulta original' }],
      },
      {
        id: 'assistant-empty',
        role: 'assistant',
        parts: [{ type: 'text', text: '   ' }],
      },
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Consulta original' }],
      },
    ] as ChatUiMessage[]

    const result = toChatConversationPublic({
      chatId: 'chat-1',
      title: 'Chat de prueba',
      messages: persistedMessages,
      createdAt: '2026-04-19T00:00:00.000Z',
      updatedAt: '2026-04-19T00:10:00.000Z',
    })

    expect(result.messages).toEqual(persistedMessages)
    expect(result.messages.map((message) => message.id)).toEqual([
      'user-1',
      'assistant-empty',
      'user-1',
    ])
    expect(result.messageCount).toBe(3)
  })

  it('truncateChatMessagesForPersistence conserva los mensajes más recientes dentro del límite', () => {
    const messages = Array.from({ length: 240 }, (_, index) => ({
      id: `msg-${index + 1}`,
      role: (index % 2 === 0 ? 'user' : 'assistant') as const,
      parts: [{ type: 'text' as const, text: `Mensaje ${index + 1}` }],
      metadata: { createdAt: 1_700_000_000_000 + index },
    })) as ChatUiMessage[]

    const truncated = truncateChatMessagesForPersistence(messages)

    expect(truncated.length).toBeLessThanOrEqual(180)
    expect(truncated[0]?.id).toBe('msg-61')
    expect(truncated[truncated.length - 1]?.id).toBe('msg-240')
  })

  it('toChatConversationSummaryPublic usa los campos persistidos cuando están disponibles', () => {
    const summary = toChatConversationSummaryPublic({
      chatId: 'chat-42',
      title: 'Resumen persistido',
      messageCount: 77,
      lastMessagePreview: 'Vista previa persistida',
      lastMessageAt: '2026-04-19T12:34:56.000Z',
      createdAt: '2026-04-19T12:00:00.000Z',
      updatedAt: '2026-04-19T12:35:00.000Z',
    })

    expect(summary.messageCount).toBe(77)
    expect(summary.lastMessagePreview).toBe('Vista previa persistida')
    expect(summary.lastMessageAt).toBe('2026-04-19T12:34:56.000Z')
  })
})
