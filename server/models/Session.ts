import mongoose, { type Document, type Types } from 'mongoose'

const { Schema, model, models } = mongoose

export interface ISession {
  _id: Types.ObjectId
  userId: Types.ObjectId
  jti: string
  ipAddress?: string
  userAgent?: string
  createdAt: Date
  lastSeenAt: Date
  expiresAt: Date
  revokedAt?: Date | null
  revokedReason?: 'user' | 'password_change' | 'email_change' | 'revoke_all' | 'expired' | null
  updatedAt: Date
}

export type ISessionDocument = Document<unknown, object, ISession> & ISession

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    lastSeenAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: {
      type: String,
      enum: ['user', 'password_change', 'email_change', 'revoke_all', 'expired'],
      default: null,
    },
  },
  { timestamps: true },
)

sessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 }, { name: 'idx_user_active' })
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expires' })

const Session =
  (models.Session as mongoose.Model<ISession> | undefined) ||
  model<ISession>('Session', sessionSchema)

export default Session
