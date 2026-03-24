import mongoose from 'mongoose'
import { AUDIT_ACTIONS, AUDIT_RESOURCES, PAGINATION } from '~~/app/types'
import AuditLog from '~~/server/models/AuditLog'
import { toAuditLogPublic } from '~~/server/utils/audit'
import { ok } from '~~/server/utils/response'

function parseDateParam(value: unknown, boundary: 'start' | 'end') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  if (boundary === 'end') {
    parsed.setUTCHours(23, 59, 59, 999)
  } else {
    parsed.setUTCHours(0, 0, 0, 0)
  }

  return parsed
}

export default defineEventHandler(async (event) => {
  requireRole(event, 'admin')

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(PAGINATION.MIN_LIMIT, Number(query.limit) || PAGINATION.DEFAULT_LIMIT),
  )
  const skip = (page - 1) * limit

  const filter: Record<string, unknown> = {}

  if (
    typeof query.resource === 'string' &&
    (AUDIT_RESOURCES as readonly string[]).includes(query.resource)
  ) {
    filter.resource = query.resource
  }

  if (
    typeof query.action === 'string' &&
    (AUDIT_ACTIONS as readonly string[]).includes(query.action)
  ) {
    filter.action = query.action
  }

  if (typeof query.userId === 'string' && mongoose.isValidObjectId(query.userId)) {
    filter.userId = new mongoose.Types.ObjectId(query.userId)
  }

  const from = parseDateParam(query.from, 'start')
  const to = parseDateParam(query.to, 'end')
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    }
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ])

  return ok(
    {
      logs: logs.map((log) => toAuditLogPublic(log)),
    },
    {
      total,
      page,
      limit,
      hasMore: skip + logs.length < total,
    },
  )
})
