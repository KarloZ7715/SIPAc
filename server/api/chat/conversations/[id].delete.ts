import { logAudit } from '~~/server/utils/audit'
import { createNotFoundError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'
import { deleteUserChatConversation } from '~~/server/services/chat/conversations'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const conversationId = getRouterParam(event, 'id')

  if (!conversationId) {
    throw createNotFoundError('Conversación')
  }

  const deletedConversation = await deleteUserChatConversation(auth.sub, conversationId)
  if (!deletedConversation) {
    throw createNotFoundError('Conversación')
  }

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'delete',
    resource: 'chat_conversation',
    resourceId: deletedConversation._id,
    details: `Conversación de chat eliminada: ${conversationId}`,
  })

  return ok({ message: 'Conversación eliminada correctamente' })
})
