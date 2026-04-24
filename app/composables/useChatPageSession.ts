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
  const isChatRouteActive = computed(() => route.path.startsWith('/chat'))

  const chatSession = shallowRef<Chat<ChatUiMessage> | null>(null)
  const draftInput = ref('')
  const draftQuote = ref('')
  const selectedDocument = ref<ChatSearchResult | null>(null)
  const previewOpen = ref(false)
  function readSelectedModelKeyFromStorage() {
    if (!import.meta.client) {
      return null
    }

    try {
      const storedValue = localStorage.getItem(CHAT_MODEL_PERSISTENCE_KEY)
      return storedValue && storedValue.trim().length > 0 ? storedValue : null
    } catch {
      return null
    }
  }

  const selectedModelKey = ref<string>(readSelectedModelKeyFromStorage() ?? 'default')
  const initializing = ref(true)
  let latestInitializationToken = 0
  let historyRecoveryRedirected = false
  let disposed = false
  let backupMessagesForRecovery: ChatUiMessage[] | null = null

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
      (draftInput.value.trim().length > 0 || draftQuote.value.trim().length > 0) &&
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

  function createSessionConversationId() {
    return conversationId.value ?? chatSession.value?.id ?? createFreshConversationId()
  }

  async function ensureConversationIdInRoute(conversationIdValue: string) {
    if (!isChatRouteActive.value) {
      return
    }

    if (conversationId.value === conversationIdValue) {
      return
    }

    await router.replace({
      path: '/chat',
      query: { id: conversationIdValue },
    })
  }

  async function ensureConversationId() {
    if (conversationId.value) {
      return conversationId.value
    }

    return createSessionConversationId()
  }

  async function initializeChatSession() {
    if (disposed || !isChatRouteActive.value) {
      return
    }

    const initializationToken = ++latestInitializationToken
    initializing.value = true

    try {
      const nextConversationId = await ensureConversationId()
      if (
        disposed ||
        !isChatRouteActive.value ||
        initializationToken !== latestInitializationToken
      ) {
        return
      }

      let initialMessages: ChatUiMessage[] = []
      let loadWarningFeedback: ReturnType<typeof getChatHistoryWarningFeedback> | null = null

      if (!conversationId.value) {
        chatStore.clearActiveConversation()
        initialMessages = []
      } else if (chatStore.activeConversation?.id === nextConversationId) {
        initialMessages = chatStore.activeConversation.messages ?? []
      } else {
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
      }

      if (
        disposed ||
        !isChatRouteActive.value ||
        initializationToken !== latestInitializationToken
      ) {
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
          if (backupMessagesForRecovery && chatSession.value) {
            chatSession.value.messages = [...backupMessagesForRecovery]
            backupMessagesForRecovery = null
          }

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
      if (initializationToken === latestInitializationToken && !disposed) {
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

    let nextInput = draftInput.value.trim()
    if (draftQuote.value.trim()) {
      const formattedQuote = draftQuote.value
        .trim()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')

      // Si el usuario no escribió nada, enviamos solo la cita.
      // Si escribió, separamos por saltos de línea.
      nextInput = nextInput ? `${formattedQuote}\n\n${nextInput}` : formattedQuote
    }

    draftInput.value = ''
    draftQuote.value = ''

    await ensureConversationIdInRoute(chatSession.value.id)

    backupMessagesForRecovery = [...chatSession.value.messages]

    try {
      await chatSession.value.sendMessage({
        text: nextInput,
      })
    } catch {
      if (backupMessagesForRecovery && chatSession.value) {
        chatSession.value.messages = [...backupMessagesForRecovery]
        backupMessagesForRecovery = null
      }
    }
  }

  async function handleSetQuote(text: string) {
    draftQuote.value = text
  }

  async function handleRegenerate(messageId: string, modelKey?: string) {
    if (!chatSession.value) return
    if (modelKey) selectedModelKey.value = modelKey

    backupMessagesForRecovery = [...chatSession.value.messages]

    try {
      await chatSession.value.regenerate({ messageId })
    } catch {
      if (backupMessagesForRecovery && chatSession.value) {
        chatSession.value.messages = [...backupMessagesForRecovery]
        backupMessagesForRecovery = null
      }
    }
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
    draftQuote.value = ''
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
    if (!isChatRouteActive.value) {
      return
    }

    await initializeChatSession()
  })

  watch(
    () => messages.value,
    (newMessages) => {
      let lastUserMsgId: string | null = null
      for (const msg of newMessages) {
        if (msg.role === 'user') {
          lastUserMsgId = msg.id
        } else if (msg.role === 'assistant' && lastUserMsgId) {
          chatStore.registerMessageVariant(lastUserMsgId, msg)
        }
      }
    },
    { deep: true, immediate: true },
  )

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
      if (disposed || !isChatRouteActive.value) {
        return
      }

      if (next === previous && chatSession.value) {
        return
      }

      if (next && chatSession.value?.id === next) {
        return
      }

      await initializeChatSession()
    },
  )

  watch(
    () => route.path,
    (path) => {
      if (!path.startsWith('/chat')) {
        latestInitializationToken += 1
      }
    },
  )

  onBeforeUnmount(() => {
    disposed = true
    latestInitializationToken += 1
  })

  return {
    chatSession,
    draftInput,
    draftQuote,
    handleSetQuote,
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
    handleRegenerate,
    startNewConversation,
    openDocument,
    buildConversationActions,
  }
}
