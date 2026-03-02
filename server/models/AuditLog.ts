import { Schema, model, models } from 'mongoose'
import { type IAuditLog, AUDIT_ACTIONS, AUDIT_RESOURCES } from '~~/app/types'

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [...AUDIT_ACTIONS],
    },
    resource: {
      type: String,
      required: true,
      enum: [...AUDIT_RESOURCES],
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    details: {
      type: String,
      maxlength: 500,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

auditLogSchema.index({ resource: 1, action: 1, createdAt: -1 }, { name: 'idx_resource_action' })
auditLogSchema.index({ userId: 1, createdAt: -1 }, { name: 'idx_user_timeline' })

export default models.AuditLog || model<IAuditLog>('AuditLog', auditLogSchema)
