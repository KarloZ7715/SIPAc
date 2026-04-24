import type { ChatUiMessage } from '~~/app/types'

export const CHAT_MAX_INCOMING_MESSAGES = 240
export const CHAT_MAX_INCOMING_USER_MESSAGE_ID_CHARS = 120
export const CHAT_MAX_INCOMING_USER_TEXT_PART_CHARS = 4_000
export const CHAT_MAX_INCOMING_USER_TEXT_TOTAL_CHARS = 12_000
export const CHAT_MAX_INCOMING_USER_TEXT_PARTS = 24

function textPartsFromMessage(message: ChatUiMessage) {
  if (!Array.isArray(message.parts)) {
    return []
  }

  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string',
    )
    .map((part) => ({
      type: 'text' as const,
      text: part.text.trim(),
    }))
    .filter((part) => part.text.length > 0)
}

/**
 * Solo confía en el último mensaje del usuario del payload entrante.
 * Descarta metadata y cualquier part no textual para evitar inyección de historial/tooling desde cliente.
 */
export function extractLatestIncomingUserMessage(messages: ChatUiMessage[]): ChatUiMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const rawMessage = messages[index] as unknown
    if (!rawMessage || typeof rawMessage !== 'object') {
      continue
    }

    const message = rawMessage as Partial<ChatUiMessage>
    if (message.role !== 'user' || typeof message.id !== 'string') {
      continue
    }

    const textParts = textPartsFromMessage(message as ChatUiMessage)
    if (textParts.length === 0) {
      continue
    }

    return {
      id: message.id,
      role: 'user',
      parts: textParts,
    }
  }

  return null
}

export function isIncomingUserMessageWithinLimits(message: ChatUiMessage): boolean {
  if (message.role !== 'user' || !Array.isArray(message.parts) || typeof message.id !== 'string') {
    return false
  }

  const normalizedMessageId = message.id.trim()
  if (
    normalizedMessageId.length === 0 ||
    normalizedMessageId.length > CHAT_MAX_INCOMING_USER_MESSAGE_ID_CHARS
  ) {
    return false
  }

  let totalChars = 0
  let textPartCount = 0

  for (const part of message.parts) {
    if (part.type !== 'text' || typeof part.text !== 'string') {
      continue
    }

    const text = part.text.trim()
    if (text.length === 0) {
      continue
    }

    if (text.length > CHAT_MAX_INCOMING_USER_TEXT_PART_CHARS) {
      return false
    }

    textPartCount += 1
    if (textPartCount > CHAT_MAX_INCOMING_USER_TEXT_PARTS) {
      return false
    }

    totalChars += text.length
    if (totalChars > CHAT_MAX_INCOMING_USER_TEXT_TOTAL_CHARS) {
      return false
    }
  }

  return totalChars > 0
}
