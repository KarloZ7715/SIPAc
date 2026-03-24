import { getHeader, getRequestIP } from 'h3'
import type { H3Event } from 'h3'
import type { AuditAction, AuditLogPublic, AuditResource, DatabaseId } from '~~/app/types'
import type { Types } from 'mongoose'

interface AuditEntry {
  userId: Types.ObjectId | string | DatabaseId
  userName: string
  action: AuditAction
  resource: AuditResource
  resourceId?: Types.ObjectId | string | DatabaseId
  details?: string
}

interface AuditMetadata {
  ipAddress?: string
  userAgent?: string | null
}

function toId(value: Types.ObjectId | string | DatabaseId | null | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  return typeof value === 'string' ? value : value.toString()
}

async function persistAuditEntry(entry: AuditEntry, metadata: AuditMetadata): Promise<void> {
  const { default: AuditLog } = await import('~~/server/models/AuditLog')

  await AuditLog.create({
    ...entry,
    ipAddress: metadata.ipAddress ?? 'unknown',
    userAgent: metadata.userAgent ?? undefined,
  })
}

/**
 * Registra una entrada de auditoría de forma no bloqueante.
 * Se importa el modelo de forma lazy para evitar dependencias circulares.
 */
export async function logAudit(event: H3Event, entry: AuditEntry): Promise<void> {
  try {
    await persistAuditEntry(entry, {
      ipAddress: getRequestIP(event, { xForwardedFor: true }) ?? 'unknown',
      userAgent: getHeader(event, 'user-agent'),
    })
  } catch (error) {
    console.error('[Audit] Error al registrar entrada:', error)
  }
}

export async function logSystemAudit(entry: AuditEntry, metadata?: AuditMetadata): Promise<void> {
  try {
    await persistAuditEntry(entry, {
      ipAddress: metadata?.ipAddress ?? 'system',
      userAgent: metadata?.userAgent ?? 'background-processing',
    })
  } catch (error) {
    console.error('[Audit] Error al registrar entrada del sistema:', error)
  }
}

export function toAuditLogPublic(log: {
  _id: Types.ObjectId | string | DatabaseId
  userId: Types.ObjectId | string | DatabaseId
  userName: string
  action: AuditAction
  resource: AuditResource
  resourceId?: Types.ObjectId | string | DatabaseId | null
  details?: string
  ipAddress: string
  userAgent?: string | null
  createdAt: Date | string
}): AuditLogPublic {
  return {
    _id: toId(log._id) ?? '',
    userId: toId(log.userId) ?? '',
    userName: log.userName,
    action: log.action,
    resource: log.resource,
    resourceId: toId(log.resourceId),
    details: log.details ?? undefined,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent ?? undefined,
    createdAt: new Date(log.createdAt).toISOString(),
  }
}
