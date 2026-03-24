import mongoose from 'mongoose'
import type { IChatConversation } from '~~/app/types'

const { Schema, model, models } = mongoose

const chatConversationSchema = new Schema<IChatConversation>(
  {
    chatId: {
      type: String,
      required: [true, 'La conversación debe tener un identificador de chat'],
      unique: true,
      trim: true,
      maxlength: 120,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'La conversación debe pertenecer a un usuario'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'La conversación debe tener un título'],
      trim: true,
      maxlength: [120, 'El título no puede superar los 120 caracteres'],
    },
    messages: {
      type: [Schema.Types.Mixed],
      default: [],
    } as never,
    isActive: {
      type: Boolean,
      default: true,
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v
        return ret
      },
    },
  },
)

chatConversationSchema.index({ userId: 1, updatedAt: -1 }, { name: 'idx_user_updated' })
chatConversationSchema.index(
  { lastAccessedAt: 1 },
  {
    expireAfterSeconds: 15_552_000,
    partialFilterExpression: { isActive: true },
    name: 'idx_chat_ttl',
  },
)

const ChatConversationModel =
  (models.ChatConversation as mongoose.Model<IChatConversation> | undefined) ||
  model<IChatConversation>('ChatConversation', chatConversationSchema)

export default ChatConversationModel
