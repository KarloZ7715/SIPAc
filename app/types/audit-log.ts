import type { DatabaseId } from './database'

export const AUDIT_ACTIONS = ['create', 'update', 'delete', 'login', 'login_failed'] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_RESOURCES = [
  'academic_product',
  'uploaded_file',
  'user',
  'session',
  'chat_conversation',
] as const
export type AuditResource = (typeof AUDIT_RESOURCES)[number]

export interface AuditLogQuery {
  resource?: AuditResource
  action?: AuditAction
  userId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface IAuditLog {
  _id: DatabaseId
  userId: DatabaseId
  userName: string
  action: AuditAction
  resource: AuditResource
  resourceId?: DatabaseId
  details?: string
  ipAddress: string
  userAgent?: string
  createdAt: Date
}

export interface AuditLogPublic {
  _id: string
  userId: string
  userName: string
  action: AuditAction
  resource: AuditResource
  resourceId?: string
  details?: string
  ipAddress: string
  userAgent?: string
  createdAt: string
}
