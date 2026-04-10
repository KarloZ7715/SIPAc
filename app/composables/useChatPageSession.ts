import type { DropdownMenuItem } from '@nuxt/ui'
import { DefaultChatTransport } from 'ai'
import { Chat } from '@ai-sdk/vue'
import type { ChatModelSelection, ChatSearchResult, ChatUiMessage } from '~~/app/types'
import {
  getChatHistoryWarningFeedback,
  getChatResponseErrorFeedback,
  getChatStopFeedback,
} from '~~/app/utils/chat-feedback'
import { createChatConversationId } from '~~/app/utils/chat-ids'
import {
  isStoppedAssistantMessage,
  markLastAssistantMessageStopped,
} from '~~/app/utils/chat-message-text'

export function useChatPageSession() {
  const CHAT_MODEL_PERSISTENCE_KEY = 'sipac:chat:selected-model-key'

  const toast = useToast()
  const route = useRoute()
  const router = useRouter()
  const chatStore = useChatStore()

  const chatSession = shallowRef<Chat<ChatUiMessage> | null>(null)
  const draftInput = ref('')
  const selectedDocument = ref<ChatSearchResult | null>(null)
  const previewOpen = ref(false)
  const selectedModelKey = ref<string>('default')
  const initializing = ref(false)
  let latestInitializationToken = 0
  let historyRecoveryRedirected = false

  const conversationId = computed(() => {
    const id = route.query.id
    return typeof id === 'string' && id.trim().length > 0 ? id : null
  })

  const selectedModel = computed<ChatModelSelection | undefined>(() => {
    if (selectedModelKey.value === 'default') {
      return undefined
    }

    const [provider, modelId] = selectedModelKey.value.split('::')
    if (!provider || !modelId) {
      return undefined
    }

    return {
      provider: provider as ChatModelSelection['provider'],
      modelId,
    }
  })

  function persistSelectedModelKey(nextKey: string) {
    if (!import.meta.client) {
      return
    }

    try {
      localStorage.setItem(CHAT_MODEL_PERSISTENCE_KEY, nextKey)
    } catch {
      /* persistencia opcional: no bloquear el chat si storage no está disponible */
    }
  }

  function restoreSelectedModelKey() {
    if (!import.meta.client) {
      return
    }

    let storedValue: string | null = null

    try {
      storedValue = localStorage.getItem(CHAT_MODEL_PERSISTENCE_KEY)
    } catch {
      return
    }

    if (!storedValue) {
      return
    }

    selectedModelKey.value = storedValue
  }

  function isManualModelStillAvailable(modelKey: string) {
    if (modelKey === 'default') {
      return true
    }

    const [provider, modelId] = modelKey.split('::')
    if (!provider || !modelId) {
      return false
    }

    const manualOptions = chatStore.providers?.manualOptions ?? []
    return manualOptions.some(
      (option) =>
        option.enabledForManual && option.provider === provider && option.modelId === modelId,
    )
  }

  function normalizeSelectedModelKey() {
    if (selectedModelKey.value === 'default') {
      return
    }

    if (!chatStore.providers) {
      return
    }

    if (!isManualModelStillAvailable(selectedModelKey.value)) {
      selectedModelKey.value = 'default'
    }
  }

  const messages = computed(() => chatSession.value?.messages ?? [])
  const chatStatus = computed(() => chatSession.value?.status ?? 'ready')
  const activeConversationTitle = computed(
    () => chatStore.activeConversation?.title ?? 'Nueva conversación',
  )
  const lastAssistantMessage = computed(
    () => [...messages.value].reverse().find((message) => message.role === 'assistant') ?? null,
  )
  const lastResponseStopped = computed(
    () => !!lastAssistantMessage.value && isStoppedAssistantMessage(lastAssistantMessage.value),
  )

  const latestSearchResults = computed(() => {
    const resultMap = new Map<string, ChatSearchResult>()

    for (const message of messages.value) {
      if (message.role !== 'assistant') {
        continue
      }

      for (const part of message.parts) {
        if (part.type === 'tool-searchRepositoryProducts' && part.state === 'output-available') {
          for (const result of part.output.results) {
            resultMap.set(result.productId, result)
          }
        }
      }
    }

    return [...resultMap.values()]
  })

  const canSend = computed(
    () =>
      Boolean(chatSession.value) &&
      !initializing.value &&
      draftInput.value.trim().length > 0 &&
      chatStatus.value !== 'submitted' &&
      chatStatus.value !== 'streaming',
  )

  const canStop = computed(
    () =>
      Boolean(chatSession.value) &&
      !initializing.value &&
      (chatStatus.value === 'submitted' || chatStatus.value === 'streaming'),
  )

  type AssistantActivityPhase = 'preparing' | 'searching' | 'writing'

  const assistantActivityPhase = computed<AssistantActivityPhase | null>(() => {
    if (chatStatus.value !== 'streaming' && chatStatus.value !== 'submitted') {
      return null
    }

    const msgs = messages.value
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'assistant') {
      return 'preparing'
    }

    for (const part of last.parts) {
      if (part.type === 'tool-searchRepositoryProducts' && part.state !== 'output-available') {
        return 'searching'
      }
    }

    return 'writing'
  })

  const assistantActivityLabel = computed(() => {
    if (chatStatus.value !== 'streaming' && chatStatus.value !== 'submitted') {
      return null
    }

    const msgs = messages.value
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'assistant') {
      return 'Preparando la respuesta…'
    }

    for (const part of last.parts) {
      if (part.type === 'tool-searchRepositoryProducts' && part.state !== 'output-available') {
        return 'Revisando documentos del repositorio…'
      }
    }

    return 'Escribiendo la respuesta…'
  })

  function getErrorStatusCode(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return undefined
    }

    const candidate = error as {
      statusCode?: number
      data?: { statusCode?: number; data?: { error?: { message?: string } } }
      statusMessage?: string
      message?: string
    }

    return candidate.statusCode ?? candidate.data?.statusCode
  }

  function createFreshConversationId() {
    return createChatConversationId()
  }

  async function ensureConversationId() {
    if (conversationId.value) {
      return conversationId.value
    }

    const nextId = createFreshConversationId()
    await router.replace({
      path: '/chat',
      query: { id: nextId },
    })
    return nextId
  }

  async function initializeChatSession() {
    const initializationToken = ++latestInitializationToken
    initializing.value = true

    try {
      const nextConversationId = await ensureConversationId()
      if (initializationToken !== latestInitializationToken) {
        return
      }

      let initialMessages: ChatUiMessage[] = []
      let loadWarningFeedback: ReturnType<typeof getChatHistoryWarningFeedback> | null = null

      try {
        const conversation = await chatStore.fetchConversation(nextConversationId)
        initialMessages = conversation?.messages ?? []
      } catch (error) {
        chatStore.clearActiveConversation()
        initialMessages = []

        if (getErrorStatusCode(error) !== 404) {
          const feedback = getChatHistoryWarningFeedback(error)

          if (!historyRecoveryRedirected) {
            historyRecoveryRedirected = true
            chatSession.value = null
            toast.add({
              title: feedback.title,
              description: feedback.description,
              color: 'warning',
              icon: 'i-lucide-triangle-alert',
            })

            await router.replace({
              path: '/chat',
              query: { id: createFreshConversationId() },
            })
            return
          }

          loadWarningFeedback = feedback
        }
      }

      if (initializationToken !== latestInitializationToken) {
        return
      }

      selectedDocument.value = null
      previewOpen.value = false

      chatSession.value = new Chat<ChatUiMessage>({
        id: nextConversationId,
        messages: initialMessages,
        transport: new DefaultChatTransport({
          api: '/api/chat',
          body: () => (selectedModel.value ? { selectedModel: selectedModel.value } : {}),
        }),
        onFinish: ({ messages, isAbort }) => {
          if (isAbort && chatSession.value?.id === nextConversationId) {
            chatSession.value.messages = markLastAssistantMessageStopped(
              messages as ChatUiMessage[],
            )

            const feedback = getChatStopFeedback()
            toast.add({
              title: feedback.title,
              description: feedback.description,
              color: 'warning',
              icon: 'i-lucide-square',
            })
          }

          void chatStore.fetchConversations().catch(() => {})
        },
        onError: (error) => {
          const feedback = getChatResponseErrorFeedback(error)
          toast.add({
            title: feedback.title,
            description: feedback.description,
            color: 'error',
            icon: 'i-lucide-octagon-alert',
          })
        },
      })

      historyRecoveryRedirected = false

      if (loadWarningFeedback) {
        toast.add({
          title: loadWarningFeedback.title,
          description: loadWarningFeedback.description,
          color: 'warning',
          icon: 'i-lucide-triangle-alert',
        })
      }
    } finally {
      if (initializationToken === latestInitializationToken) {
        initializing.value = false
      }
    }
  }

  async function handleSubmit() {
    if (!chatSession.value) {
      await initializeChatSession()
    }

    if (!chatSession.value || !canSend.value) {
      return
    }

    const nextInput = draftInput.value.trim()
    draftInput.value = ''

    await chatSession.value.sendMessage({
      text: nextInput,
    })
  }

  async function stopConversation() {
    if (!chatSession.value || !canStop.value) {
      return
    }

    await chatSession.value.stop()
  }

  async function startNewConversation() {
    chatStore.clearActiveConversation()
    draftInput.value = ''
    selectedDocument.value = null
    previewOpen.value = false

    await router.push({
      path: '/chat',
      query: { id: createFreshConversationId() },
    })
  }

  function openDocument(result: ChatSearchResult) {
    selectedDocument.value = result
    previewOpen.value = true
  }

  function buildConversationActions(conversationIdValue: string): DropdownMenuItem[][] {
    return [
      [
        {
          label: 'Eliminar conversación',
          icon: 'i-lucide-trash-2',
          color: 'error',
          onSelect: async () => {
            await chatStore.deleteConversation(conversationIdValue)

            if (conversationId.value === conversationIdValue) {
              await startNewConversation()
            }
          },
        },
      ],
    ]
  }

  onMounted(async () => {
    restoreSelectedModelKey()
    await chatStore.fetchConversations()
    await initializeChatSession()
  })

  watch(
    () => selectedModelKey.value,
    (nextKey) => {
      persistSelectedModelKey(nextKey)
    },
  )

  watch(
    () => chatStore.providers,
    () => {
      normalizeSelectedModelKey()
    },
    { deep: true },
  )

  watch(
    () => conversationId.value,
    async (next, previous) => {
      if (next === previous && chatSession.value) {
        return
      }

      await initializeChatSession()
    },
  )

  return {
    chatSession,
    draftInput,
    selectedDocument,
    previewOpen,
    selectedModelKey,
    initializing,
    conversationId,
    selectedModel,
    messages,
    chatStatus,
    activeConversationTitle,
    lastResponseStopped,
    latestSearchResults,
    canSend,
    canStop,
    assistantActivityPhase,
    assistantActivityLabel,
    initializeChatSession,
    handleSubmit,
    stopConversation,
    startNewConversation,
    openDocument,
    buildConversationActions,
  }
}
