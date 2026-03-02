import { type Types } from 'mongoose'

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'verify',
  'reject',
  'login',
  'login_failed',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_RESOURCES = ['academic_product', 'uploaded_file', 'user', 'session'] as const
export type AuditResource = (typeof AUDIT_RESOURCES)[number]

export interface IAuditLog {
  _id: Types.ObjectId
  userId: Types.ObjectId
  userName: string
  action: AuditAction
  resource: AuditResource
  resourceId?: Types.ObjectId
  details?: string
  ipAddress: string
  userAgent?: string
  createdAt: Date
}
