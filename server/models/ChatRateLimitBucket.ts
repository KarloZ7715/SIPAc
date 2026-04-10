import mongoose from 'mongoose'

interface IChatRateLimitBucket {
  _id: string
  scope: string
  userId: string
  windowStartedAt: Date
  expiresAt: Date
  count: number
}

const { Schema, model, models } = mongoose

const chatRateLimitBucketSchema = new Schema<IChatRateLimitBucket>(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
    },
    scope: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    windowStartedAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  },
)

chatRateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expires_at' })

const ChatRateLimitBucketModel =
  (models.ChatRateLimitBucket as mongoose.Model<IChatRateLimitBucket> | undefined) ||
  model<IChatRateLimitBucket>('ChatRateLimitBucket', chatRateLimitBucketSchema)

export default ChatRateLimitBucketModel
