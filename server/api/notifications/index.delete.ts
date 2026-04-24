import Notification from '~~/server/models/Notification'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const result = await Notification.deleteMany({
    recipientId: auth.sub,
  })

  return ok({ deletedCount: result.deletedCount })
})
