import { describe, expect, it } from 'vitest'
import type { ChatUiMessage } from '~~/app/types'
import { sanitizeChatMessages } from '~~/server/services/chat/conversations'

describe('chat conversation sanitization', () => {
  it('elimina mensajes vacíos y usuarios consecutivos duplicados', () => {
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
        id: 'user-duplicate',
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
})
