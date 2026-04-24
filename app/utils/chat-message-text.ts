import type { ChatUiMessage } from '~~/app/types'
import { stripPrivateThinkingBlocks } from '~~/app/utils/chat-private-thinking'

export function chatMessagePlainText(message: ChatUiMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => stripPrivateThinkingBlocks(part.text).trim())
    .filter(Boolean)
    .join('\n\n')
}

export function isStoppedAssistantMessage(message: ChatUiMessage): boolean {
  return message.role === 'assistant' && message.metadata?.stoppedByUser === true
}

export function hasAssistantMessageAfterIndex(messages: ChatUiMessage[], index: number): boolean {
  const safeStart = Math.max(-1, Math.trunc(index))
  return messages.some(
    (message, messageIndex) => messageIndex > safeStart && message.role === 'assistant',
  )
}

export function markLastAssistantMessageStopped(messages: ChatUiMessage[]): ChatUiMessage[] {
  const lastUserIndex = [...messages].map((message) => message.role).lastIndexOf('user')
  const lastAssistantIndex = messages.findLastIndex(
    (message, index) => message.role === 'assistant' && index > lastUserIndex,
  )

  if (lastAssistantIndex === -1) {
    return messages
  }

  return messages.map((message, index) => {
    if (index !== lastAssistantIndex || message.role !== 'assistant') {
      return message
    }

    return {
      ...message,
      metadata: {
        ...message.metadata,
        stoppedByUser: true,
      },
    }
  })
}
