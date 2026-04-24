import type {
  ChatConversationPublic,
  ChatConversationSummaryPublic,
  ChatUiMessage,
} from '~~/app/types'
import { stripPrivateThinkingBlocks } from '~~/app/utils/chat-private-thinking'
import ChatConversation from '~~/server/models/ChatConversation'

const MAX_PERSISTED_CHAT_MESSAGES = 180
const MAX_PERSISTED_CHAT_MESSAGES_JSON_BYTES = 1_000_000

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * El esquema de `validateUIMessages` (AI SDK) usa `.optional()` en metadatos de proveedor;
 * `null` desde JSON/cliente no es equivalente a omitir la clave y hace fallar el union
 * (mensaje engañoso: type debe empezar por `data-`).
 */
function stripNullProviderMetadataFields(
  part: ChatUiMessage['parts'][number],
): ChatUiMessage['parts'][number] {
  if (typeof part !== 'object' || part === null) {
    return part
  }

  const raw = part as Record<string, unknown>
  let next: Record<string, unknown> | null = null

  if ('providerMetadata' in raw && raw.providerMetadata === null) {
    next = { ...raw }
    delete next.providerMetadata
  }

  if ('callProviderMetadata' in raw && raw.callProviderMetadata === null) {
    next = next ?? { ...raw }
    delete next.callProviderMetadata
  }

  return (next ?? raw) as ChatUiMessage['parts'][number]
}

/**
 * Partes `tool-*` persistidas / reenviadas desde el cliente a veces traen `null` en campos
 * que el esquema de `validateUIMessages` trata como ausentes (`optional`, `never`) y claves
 * que el SDK no define (`title`, `rawInput` en estados distintos de `output-error`).
 */
function sanitizeToolUIPart(part: ChatUiMessage['parts'][number]): ChatUiMessage['parts'][number] {
  if (typeof part !== 'object' || part === null) {
    return part
  }

  if (typeof part.type !== 'string' || !part.type.startsWith('tool-')) {
    return part
  }

  const raw = part as Record<string, unknown>
  const state = raw.state

  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'title') {
      continue
    }
    if (key === 'rawInput' && state !== 'output-error') {
      continue
    }
    if (value === null) {
      continue
    }
    cleaned[key] = value
  }

  return cleaned as ChatUiMessage['parts'][number]
}

function clampToolLimit(limit: unknown) {
  if (typeof limit === 'number' && Number.isFinite(limit)) {
    return Math.min(8, Math.max(1, Math.trunc(limit)))
  }

  if (typeof limit === 'string' && limit.trim().length > 0) {
    const parsed = Number(limit)
    if (Number.isFinite(parsed)) {
      return Math.min(8, Math.max(1, Math.trunc(parsed)))
    }
  }

  return undefined
}

function normalizeMessagePart(
  messageRole: ChatUiMessage['role'],
  part: ChatUiMessage['parts'][number],
): ChatUiMessage['parts'][number] | null {
  const partType = typeof part.type === 'string' ? part.type : ''

  part = stripNullProviderMetadataFields(part)

  if (partType.startsWith('tool-')) {
    part = sanitizeToolUIPart(part)
  }

  if (partType === 'reasoning' || partType.startsWith('reasoning-')) {
    return null
  }

  if (messageRole === 'assistant' && part.type === 'text') {
    const sanitizedText = stripPrivateThinkingBlocks(part.text)

    if (sanitizedText.trim().length === 0) {
      return null
    }

    if (sanitizedText !== part.text) {
      return {
        ...part,
        text: sanitizedText,
      }
    }
  }

  if (part.type === 'tool-searchRepositoryProducts') {
    const normalizedLimit = clampToolLimit(part.input?.limit)
    if (
      normalizedLimit === undefined ||
      !part.input ||
      typeof part.input.question !== 'string' ||
      part.input.question.trim().length === 0
    ) {
      return part
    }

    const normalizedInput = {
      ...part.input,
      question: part.input.question,
      limit: normalizedLimit,
    }

    return {
      ...part,
      input: normalizedInput,
    }
  }

  return part
}

function normalizeMessageParts(message: ChatUiMessage): ChatUiMessage {
  const parts = [] as ChatUiMessage['parts']

  for (const part of message.parts) {
    const normalizedPart = normalizeMessagePart(message.role, part)
    if (normalizedPart) {
      parts.push(normalizedPart)
    }
  }

  // Reconstrucción explícita para evitar arrastrar campos legacy (p. ej. reasoning/reasoning_content)
  // que algunos proveedores openai-compatible rechazan en mensajes assistant históricos.
  return {
    id: message.id,
    role: message.role,
    metadata: message.metadata,
    parts,
  }
}

function hasRenderablePart(message: ChatUiMessage) {
  if (!Array.isArray(message.parts) || message.parts.length === 0) {
    return false
  }

  const hasRenderableText = message.parts.some(
    (part) => part.type === 'text' && part.text.trim().length > 0,
  )
  const hasRenderableToolOutput = message.parts.some(
    (part) => part.type === 'tool-searchRepositoryProducts' && part.state === 'output-available',
  )

  if (message.role === 'assistant') {
    // Evita persistir turnos assistant sin texto visible, aunque incluyan tool parts transitorios.
    return hasRenderableText || hasRenderableToolOutput
  }

  return (
    hasRenderableText ||
    message.parts.some((part) => {
      if (part.type === 'tool-searchRepositoryProducts') {
        return part.state === 'output-available'
      }

      return part.type !== 'text'
    })
  )
}

export function sanitizeChatMessages(messages: ChatUiMessage[]) {
  const normalizedMessages = messages.map(normalizeMessageParts)
  const withoutEmptyMessages = normalizedMessages.filter(hasRenderablePart)

  return withoutEmptyMessages.filter((message, index, list) => {
    if (message.role !== 'user') {
      return true
    }

    const previousMessage = list[index - 1]
    if (!previousMessage || previousMessage.role !== 'user') {
      return true
    }

    return previousMessage.id !== message.id
  })
}

function extractTextParts(message: ChatUiMessage | undefined) {
  if (!message) {
    return ''
  }

  return normalizeWhitespace(
    message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join(' '),
  )
}

function extractConversationTitle(messages: ChatUiMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user')
  const rawText = extractTextParts(firstUserMessage)

  if (!rawText) {
    return 'Nueva conversación'
  }

  const trimmed = rawText.slice(0, 90)
  return trimmed.length < rawText.length ? `${trimmed}...` : trimmed
}

function extractLastMessagePreview(messages: ChatUiMessage[]) {
  const candidate = [...messages].reverse().find((message) => extractTextParts(message).length > 0)
  const rawText = extractTextParts(candidate)

  if (!rawText) {
    return undefined
  }

  const trimmed = rawText.slice(0, 140)
  return trimmed.length < rawText.length ? `${trimmed}...` : trimmed
}

function estimateUtf8Bytes(value: string) {
  return new TextEncoder().encode(value).length
}

export function truncateChatMessagesForPersistence(messages: ChatUiMessage[]) {
  let truncated = messages.slice(-MAX_PERSISTED_CHAT_MESSAGES)

  while (
    truncated.length > 1 &&
    estimateUtf8Bytes(JSON.stringify(truncated)) > MAX_PERSISTED_CHAT_MESSAGES_JSON_BYTES
  ) {
    truncated = truncated.slice(1)
  }

  return truncated
}

/**
 * Marca temporal para historial: último mensaje con `metadata.createdAt`;
 * si no hay timestamps en mensajes pero hay mensajes, se usa `updatedAt`;
 * si no hay mensajes, `createdAt` (conversación vacía).
 */
export function computeChatLastMessageAtIso(
  messages: ChatUiMessage[],
  updatedAt: Date | string,
  createdAt: Date | string,
): string {
  let maxTs = 0
  for (const message of messages) {
    const t = message.metadata?.createdAt
    if (typeof t === 'number' && Number.isFinite(t) && t > maxTs) {
      maxTs = t
    }
  }

  if (maxTs > 0) {
    return new Date(maxTs).toISOString()
  }

  if (messages.length > 0) {
    return new Date(updatedAt).toISOString()
  }

  return new Date(createdAt).toISOString()
}

function serializeSummary(conversation: {
  chatId: string
  title: string
  messages?: ChatUiMessage[]
  messageCount?: number
  lastMessagePreview?: string
  lastMessageAt?: Date | string
  createdAt: Date | string
  updatedAt: Date | string
}): ChatConversationSummaryPublic {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : []
  const messageCount =
    typeof conversation.messageCount === 'number' && Number.isFinite(conversation.messageCount)
      ? Math.max(0, Math.trunc(conversation.messageCount))
      : messages.length
  const lastMessagePreview =
    typeof conversation.lastMessagePreview === 'string'
      ? conversation.lastMessagePreview
      : extractLastMessagePreview(messages)
  const lastMessageAt =
    conversation.lastMessageAt !== undefined
      ? new Date(conversation.lastMessageAt).toISOString()
      : computeChatLastMessageAtIso(messages, conversation.updatedAt, conversation.createdAt)

  return {
    id: conversation.chatId,
    title: conversation.title,
    messageCount,
    lastMessagePreview,
    lastMessageAt,
    createdAt: new Date(conversation.createdAt).toISOString(),
    updatedAt: new Date(conversation.updatedAt).toISOString(),
  }
}

export function toChatConversationSummaryPublic(conversation: {
  chatId: string
  title: string
  messages?: ChatUiMessage[]
  messageCount?: number
  lastMessagePreview?: string
  lastMessageAt?: Date | string
  createdAt: Date | string
  updatedAt: Date | string
}) {
  return serializeSummary(conversation)
}

export function toChatConversationPublic(conversation: {
  chatId: string
  title: string
  messages: ChatUiMessage[]
  messageCount?: number
  lastMessagePreview?: string
  lastMessageAt?: Date | string
  createdAt: Date | string
  updatedAt: Date | string
}): ChatConversationPublic {
  const messages = conversation.messages

  return {
    ...serializeSummary({
      ...conversation,
      messages,
    }),
    messages,
  }
}

export async function listUserChatConversations(userId: string, limit = 20) {
  const conversations = await ChatConversation.find(
    {
      userId,
      isActive: true,
    },
    {
      chatId: 1,
      title: 1,
      messageCount: 1,
      lastMessagePreview: 1,
      lastMessageAt: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  )
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(limit)
    .lean()

  const missingSummaryChatIds = conversations
    .filter(
      (conversation) =>
        typeof conversation.messageCount !== 'number' || conversation.lastMessageAt === undefined,
    )
    .map((conversation) => conversation.chatId)

  if (missingSummaryChatIds.length === 0) {
    return conversations.map(toChatConversationSummaryPublic)
  }

  const legacyConversations = await ChatConversation.find(
    {
      userId,
      isActive: true,
      chatId: { $in: missingSummaryChatIds },
    },
    {
      chatId: 1,
      title: 1,
      messages: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  ).lean()

  const legacySummaries = new Map(
    legacyConversations.map((conversation) => [
      conversation.chatId,
      toChatConversationSummaryPublic(conversation),
    ]),
  )

  const summaries = conversations.map((conversation) => {
    const legacySummary = legacySummaries.get(conversation.chatId)
    if (legacySummary) {
      return legacySummary
    }

    return toChatConversationSummaryPublic(conversation)
  })

  summaries.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  )

  return summaries
}

export async function getUserChatConversation(userId: string, chatId: string) {
  return ChatConversation.findOne({
    userId,
    chatId,
    isActive: true,
  })
}

export async function saveUserChatConversation(input: {
  userId: string
  chatId: string
  messages: ChatUiMessage[]
}) {
  const sanitizedMessages = sanitizeChatMessages(input.messages)
  const messages = truncateChatMessagesForPersistence(sanitizedMessages)
  const now = new Date()
  const title = extractConversationTitle(sanitizedMessages)
  const messageCount = messages.length
  const lastMessagePreview = extractLastMessagePreview(messages)
  const lastMessageAt = new Date(computeChatLastMessageAtIso(messages, now, now))

  return ChatConversation.findOneAndUpdate(
    {
      userId: input.userId,
      chatId: input.chatId,
    },
    {
      $set: {
        title,
        messages,
        messageCount,
        lastMessagePreview,
        lastMessageAt,
        isActive: true,
        lastAccessedAt: now,
      },
      $setOnInsert: {
        chatId: input.chatId,
        userId: input.userId,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
    },
  )
}

export async function touchUserChatConversation(userId: string, chatId: string) {
  return ChatConversation.findOneAndUpdate(
    {
      userId,
      chatId,
      isActive: true,
    },
    {
      $set: {
        lastAccessedAt: new Date(),
      },
    },
    { returnDocument: 'after', timestamps: false },
  )
}

export async function deleteUserChatConversation(userId: string, chatId: string) {
  return ChatConversation.findOneAndDelete({
    userId,
    chatId,
    isActive: true,
  })
}
