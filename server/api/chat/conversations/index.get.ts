import { ok } from '~~/server/utils/response'
import { listUserChatConversations } from '~~/server/services/chat/conversations'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const requestedLimit = typeof query.limit === 'string' ? Number(query.limit) : undefined
  const limit =
    typeof requestedLimit === 'number' && Number.isFinite(requestedLimit)
      ? Math.min(30, Math.max(1, requestedLimit))
      : 20

  const conversations = await listUserChatConversations(auth.sub, limit)

  return ok(
    { conversations },
    {
      total: conversations.length,
      limit,
      hasMore: conversations.length >= limit,
    },
  )
})
