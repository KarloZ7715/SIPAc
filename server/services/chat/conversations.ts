import type {
  ChatConversationPublic,
  ChatConversationSummaryPublic,
  ChatUiMessage,
} from '~~/app/types'
import ChatConversation from '~~/server/models/ChatConversation'

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
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
  const withoutEmptyMessages = messages.filter(hasRenderablePart)

  return withoutEmptyMessages.filter((message, index, list) => {
    if (message.role !== 'user') {
      return true
    }

    const previousMessage = list[index - 1]
    if (!previousMessage || previousMessage.role !== 'user') {
      return true
    }

    return (
      normalizeWhitespace(JSON.stringify(previousMessage.parts)) !==
      normalizeWhitespace(JSON.stringify(message.parts))
    )
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
  const conversations = await ChatConversation.find({
    userId,
    isActive: true,
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean()

  return conversations.map(toChatConversationSummaryPublic)
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
    { returnDocument: 'after' },
  )
}

export async function deleteUserChatConversation(userId: string, chatId: string) {
  return ChatConversation.findOneAndDelete({
    userId,
    chatId,
    isActive: true,
  })
}
