import mongoose from 'mongoose'
import Notification from '~~/server/models/Notification'
import { createNotFoundError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const notificationId = event.context.params?.id

  if (!notificationId || !mongoose.isValidObjectId(notificationId)) {
    throw createNotFoundError('Notificacion')
  }

  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipientId: auth.sub,
    },
    {
      $set: { isRead: true },
    },
    {
      returnDocument: 'after',
    },
  )

  if (!notification) {
    throw createNotFoundError('Notificacion')
  }

  return ok({ notification: notification.toJSON() })
})
