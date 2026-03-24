import { createNotFoundError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'
import {
  getUserChatConversation,
  toChatConversationPublic,
  touchUserChatConversation,
} from '~~/server/services/chat/conversations'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const conversationId = getRouterParam(event, 'id')

  if (!conversationId) {
    throw createNotFoundError('Conversación')
  }

  const conversation = await getUserChatConversation(auth.sub, conversationId)
  if (!conversation) {
    throw createNotFoundError('Conversación')
  }

  await touchUserChatConversation(auth.sub, conversationId)

  return ok({
    conversation: toChatConversationPublic(conversation.toObject()),
  })
})
