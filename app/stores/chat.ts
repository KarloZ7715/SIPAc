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

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<ChatConversationSummaryPublic[]>([])
  const activeConversation = ref<ChatConversationPublic | null>(null)
  const providers = ref<ChatProvidersResponse | null>(null)
  const conversationsLoading = ref(false)
  const conversationLoading = ref(false)
  const providersLoading = ref(false)
  const deletingConversationId = ref<string | null>(null)

  async function fetchConversations(limit = 20) {
    conversationsLoading.value = true

    try {
      const response = await $fetch<ChatConversationListResponse>('/api/chat/conversations', {
        query: { limit },
      })

      conversations.value = response.data.conversations
      return conversations.value
    } finally {
      conversationsLoading.value = false
    }
  }

  async function fetchConversation(id: string) {
    conversationLoading.value = true

    try {
      const response = await $fetch<ChatConversationResponse>(`/api/chat/conversations/${id}`)
      activeConversation.value = response.data.conversation
      return activeConversation.value
    } finally {
      conversationLoading.value = false
    }
  }

  async function fetchProviders() {
    providersLoading.value = true

    try {
      const response = await $fetch<ChatProvidersApiResponse>('/api/chat/providers')
      providers.value = response.data
      return providers.value
    } catch (error) {
      providers.value = null
      throw error
    } finally {
      providersLoading.value = false
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
    deletingConversationId,
    fetchConversations,
    fetchConversation,
    fetchProviders,
    deleteConversation,
    clearActiveConversation,
  }
})
