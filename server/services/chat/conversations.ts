import type {
  ChatConversationPublic,
  ChatConversationSummaryPublic,
  ChatUiMessage,
} from '~~/app/types'
import ChatConversation from '~~/server/models/ChatConversation'

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
  part: ChatUiMessage['parts'][number],
): ChatUiMessage['parts'][number] | null {
  part = stripNullProviderMetadataFields(part)

  if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
    part = sanitizeToolUIPart(part)
  }

  if (part.type === 'reasoning' || part.type.startsWith('reasoning-')) {
    return null
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
    const normalizedPart = normalizeMessagePart(part)
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
  return (
    Array.isArray(message.parts) &&
    message.parts.some((part) => {
      if (part.type === 'text') {
        return part.text.trim().length > 0
      }

      return true
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
  messages: ChatUiMessage[]
  createdAt: Date | string
  updatedAt: Date | string
}): ChatConversationSummaryPublic {
  return {
    id: conversation.chatId,
    title: conversation.title,
    messageCount: conversation.messages.length,
    lastMessagePreview: extractLastMessagePreview(conversation.messages),
    lastMessageAt: computeChatLastMessageAtIso(
      conversation.messages,
      conversation.updatedAt,
      conversation.createdAt,
    ),
    createdAt: new Date(conversation.createdAt).toISOString(),
    updatedAt: new Date(conversation.updatedAt).toISOString(),
  }
}

export function toChatConversationSummaryPublic(conversation: {
  chatId: string
  title: string
  messages: ChatUiMessage[]
  createdAt: Date | string
  updatedAt: Date | string
}) {
  return serializeSummary(conversation)
}

export function toChatConversationPublic(conversation: {
  chatId: string
  title: string
  messages: ChatUiMessage[]
  createdAt: Date | string
  updatedAt: Date | string
}): ChatConversationPublic {
  const messages = sanitizeChatMessages(conversation.messages)

  return {
    ...serializeSummary({
      ...conversation,
      messages,
    }),
    messages,
  }
}

export async function listUserChatConversations(userId: string, limit = 20) {
  const fetchCap = Math.min(200, Math.max(limit * 15, 60))
  const conversations = await ChatConversation.find({
    userId,
    isActive: true,
  })
    .sort({ updatedAt: -1 })
    .limit(fetchCap)
    .lean()

  const summaries = conversations.map(toChatConversationSummaryPublic)
  summaries.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  )

  return summaries.slice(0, limit)
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
  const messages = sanitizeChatMessages(input.messages)
  const title = extractConversationTitle(messages)
  const now = new Date()

  return ChatConversation.findOneAndUpdate(
    {
      userId: input.userId,
      chatId: input.chatId,
    },
    {
      $set: {
        title,
        messages,
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
