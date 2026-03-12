import mongoose from 'mongoose'
import { NOTIFICATION_TYPES, RELATED_RESOURCE_KINDS, type INotification } from '~~/app/types'

const { Schema, model, models } = mongoose

const relatedResourceSchema = new Schema(
  {
    kind: {
      type: String,
      enum: [...RELATED_RESOURCE_KINDS],
      required: true,
    },
    id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: false },
)

const notificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'La notificación debe tener un destinatario'],
    },
    type: {
      type: String,
      required: [true, 'El tipo de notificación es obligatorio'],
      enum: [...NOTIFICATION_TYPES],
    },
    title: {
      type: String,
      required: [true, 'El título es obligatorio'],
      maxlength: [200, 'El título no puede superar los 200 caracteres'],
    },
    message: {
      type: String,
      required: [true, 'El mensaje es obligatorio'],
      maxlength: [1000, 'El mensaje no puede superar los 1000 caracteres'],
    },
    relatedResource: {
      type: relatedResourceSchema,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v
        return ret
      },
    },
  },
)

notificationSchema.index(
  { recipientId: 1, isRead: 1, createdAt: -1 },
  { name: 'idx_user_notifications' },
)
notificationSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 7_776_000,
    name: 'idx_ttl_cleanup',
  },
)

const NotificationModel =
  (models.Notification as mongoose.Model<INotification> | undefined) ||
  model<INotification>('Notification', notificationSchema)

export default NotificationModel
