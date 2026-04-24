import { describe, expect, it } from 'vitest'
import ChatConversation from '~~/server/models/ChatConversation'

describe('ChatConversation schema', () => {
  it('usa índice único compuesto por usuario y chatId', () => {
    const indexes = ChatConversation.schema.indexes()

    expect(ChatConversation.schema.path('chatId')?.options.unique).toBeUndefined()
    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ userId: 1, chatId: 1 }, expect.objectContaining({ unique: true, name: 'ux_user_chat' })],
      ]),
    )
  })

  it('incluye campos de resumen persistido e índice por lastMessageAt', () => {
    const indexes = ChatConversation.schema.indexes()

    expect(ChatConversation.schema.path('messageCount')).toBeDefined()
    expect(ChatConversation.schema.path('lastMessagePreview')).toBeDefined()
    expect(ChatConversation.schema.path('lastMessageAt')).toBeDefined()
    expect(indexes).toEqual(
      expect.arrayContaining([
        [
          { userId: 1, lastMessageAt: -1 },
          expect.objectContaining({ name: 'idx_user_last_message_at' }),
        ],
      ]),
    )
  })
})
