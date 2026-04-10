export function createChatConversationId() {
  if (import.meta.client && typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `chat_${crypto.randomUUID().replace(/-/g, '')}`
  }

  return `chat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}
