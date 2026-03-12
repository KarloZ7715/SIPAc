import Notification from '~~/server/models/Notification'
import { ok } from '~~/server/utils/response'

function parseUnreadOnly(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const unreadOnly = parseUnreadOnly(
    typeof query.unreadOnly === 'string' ? query.unreadOnly : undefined,
  )

  const notifications = await Notification.find({
    recipientId: auth.sub,
    ...(unreadOnly ? { isRead: false } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(50)

  return ok({
    notifications: notifications.map((notification) => notification.toJSON()),
  })
})
