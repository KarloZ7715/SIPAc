import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatStore } from '~~/app/stores/chat'

describe('useChatStore', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
    vi.stubGlobal('$fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hidrata conversaciones desde el backend', async () => {
    const store = useChatStore()

    fetchMock.mockResolvedValueOnce({
      success: true,
      data: {
        conversations: [
          {
            id: 'chat-1',
            title: 'Investigación de artículos',
            messageCount: 4,
            lastMessagePreview: 'Encontré 2 coincidencias',
            createdAt: '2026-03-23T10:00:00.000Z',
            updatedAt: '2026-03-23T10:05:00.000Z',
          },
        ],
      },
    })

    await store.fetchConversations()

    expect(store.conversations).toHaveLength(1)
    expect(store.conversations[0]?.id).toBe('chat-1')
    expect(store.conversationsLoading).toBe(false)
  })

  it('carga una conversación y la limpia al eliminarla', async () => {
    const store = useChatStore()

    fetchMock.mockResolvedValueOnce({
      success: true,
      data: {
        conversation: {
          id: 'chat-1',
          title: 'Investigación de artículos',
          messageCount: 2,
          lastMessagePreview: 'Encontré 2 coincidencias',
          createdAt: '2026-03-23T10:00:00.000Z',
          updatedAt: '2026-03-23T10:05:00.000Z',
          messages: [],
        },
      },
    })

    store.conversations = [
      {
        id: 'chat-1',
        title: 'Investigación de artículos',
        messageCount: 2,
        lastMessagePreview: 'Encontré 2 coincidencias',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:05:00.000Z',
      },
      {
        id: 'chat-2',
        title: 'Otra conversación',
        messageCount: 1,
        lastMessagePreview: 'Sin resultados',
        createdAt: '2026-03-23T09:00:00.000Z',
        updatedAt: '2026-03-23T09:01:00.000Z',
      },
    ]

    await store.fetchConversation('chat-1')

    expect(store.activeConversation?.id).toBe('chat-1')
    expect(store.conversationLoading).toBe(false)

    fetchMock.mockResolvedValueOnce({
      success: true,
      data: {
        message: 'Conversation deleted',
      },
    })

    await store.deleteConversation('chat-1')

    expect(store.conversations.map((conversation) => conversation.id)).toEqual(['chat-2'])
    expect(store.activeConversation).toBeNull()
    expect(store.deletingConversationId).toBeNull()
  })
})
