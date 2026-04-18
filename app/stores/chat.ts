import type {
  ApiSuccessResponse,
  ChatConversationPublic,
  ChatConversationSummaryPublic,
  ChatProvidersResponse,
} from '~~/app/types'

type ChatConversationListResponse = ApiSuccessResponse<{
  conversations: ChatConversationSummaryPublic[]
}>
type ChatConversationResponse = ApiSuccessResponse<{
  conversation: ChatConversationPublic
}>
type ChatProvidersApiResponse = ApiSuccessResponse<ChatProvidersResponse>
type ChatDeleteResponse = ApiSuccessResponse<{ message: string }>
type StoreFetch = <T>(request: string, options?: Parameters<typeof $fetch>[1]) => Promise<T>

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<ChatConversationSummaryPublic[]>([])
  const activeConversation = ref<ChatConversationPublic | null>(null)
  const providers = ref<ChatProvidersResponse | null>(null)
  const conversationsLoading = ref(false)
  const conversationLoading = ref(false)
  const providersLoading = ref(false)
  const conversationsResolved = ref(false)
  const providersResolved = ref(false)
  const deletingConversationId = ref<string | null>(null)

  async function fetchConversations(limit = 20, fetcher: StoreFetch = $fetch) {
    conversationsLoading.value = true

    try {
      const response = await fetcher<ChatConversationListResponse>('/api/chat/conversations', {
        query: { limit },
      })

      conversations.value = response.data.conversations
      return conversations.value
    } finally {
      conversationsLoading.value = false
      conversationsResolved.value = true
    }
  }

  async function fetchConversation(id: string, fetcher: StoreFetch = $fetch) {
    conversationLoading.value = true

    try {
      const response = await fetcher<ChatConversationResponse>(`/api/chat/conversations/${id}`)
      activeConversation.value = response.data.conversation
      return activeConversation.value
    } catch (error) {
      activeConversation.value = null
      throw error
    } finally {
      conversationLoading.value = false
    }
  }

  async function fetchProviders(fetcher: StoreFetch = $fetch) {
    providersLoading.value = true

    try {
      const response = await fetcher<ChatProvidersApiResponse>('/api/chat/providers')
      providers.value = response.data
      return providers.value
    } catch (error) {
      providers.value = null
      throw error
    } finally {
      providersLoading.value = false
      providersResolved.value = true
    }
  }

  async function deleteConversation(id: string) {
    deletingConversationId.value = id

    try {
      await $fetch<ChatDeleteResponse>(`/api/chat/conversations/${id}`, {
        method: 'DELETE',
      })

      conversations.value = conversations.value.filter((conversation) => conversation.id !== id)
      if (activeConversation.value?.id === id) {
        activeConversation.value = null
      }
    } finally {
      deletingConversationId.value = null
    }
  }

  function clearActiveConversation() {
    activeConversation.value = null
  }

  return {
    conversations,
    activeConversation,
    providers,
    conversationsLoading,
    conversationLoading,
    providersLoading,
    conversationsResolved,
    providersResolved,
    deletingConversationId,
    fetchConversations,
    fetchConversation,
    fetchProviders,
    deleteConversation,
    clearActiveConversation,
  }
})
