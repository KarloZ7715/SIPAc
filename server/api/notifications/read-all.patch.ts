import Notification from '~~/server/models/Notification'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const result = await Notification.updateMany(
    {
      recipientId: auth.sub,
      isRead: false,
    },
    {
      $set: { isRead: true },
    },
  )

  return ok({ updatedCount: result.modifiedCount })
})
