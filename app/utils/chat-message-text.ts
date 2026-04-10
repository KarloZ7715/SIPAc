import type { ChatUiMessage } from '~~/app/types'

export function chatMessagePlainText(message: ChatUiMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join('\n\n')
}

export function isStoppedAssistantMessage(message: ChatUiMessage): boolean {
  return message.role === 'assistant' && message.metadata?.stoppedByUser === true
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
