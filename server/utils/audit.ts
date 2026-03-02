import { type H3Event, getRequestIP, getHeader } from 'h3'
import { type AuditAction, type AuditResource } from '~~/app/types'
import { type Types } from 'mongoose'

interface AuditEntry {
  userId: Types.ObjectId | string
  userName: string
  action: AuditAction
  resource: AuditResource
  resourceId?: Types.ObjectId | string
  details?: string
}

/**
 * Registra una entrada de auditoría de forma no bloqueante.
 * Se importa el modelo de forma lazy para evitar dependencias circulares.
 */
export async function logAudit(event: H3Event, entry: AuditEntry): Promise<void> {
  try {
    const { default: AuditLog } = await import('~~/server/models/AuditLog')

    await AuditLog.create({
      ...entry,
      ipAddress: getRequestIP(event, { xForwardedFor: true }) ?? 'unknown',
      userAgent: getHeader(event, 'user-agent'),
    })
  } catch (error) {
    console.error('[Audit] Error al registrar entrada:', error)
  }
}
