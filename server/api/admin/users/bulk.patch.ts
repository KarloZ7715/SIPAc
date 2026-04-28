import { z } from 'zod'
import mongoose from 'mongoose'
import User from '~~/server/models/User'
import { USER_ROLES } from '~~/app/types'
import { logAudit } from '~~/server/utils/audit'
import { requireRole } from '~~/server/utils/authorize'
import { createBadRequestError, createValidationError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'

const bulkUpdateSchema = z.object({
  ids: z
    .array(z.string().refine((id) => mongoose.isValidObjectId(id), 'ID inválido'))
    .min(1, 'Se requiere al menos un ID')
    .max(100, 'Máximo 100 usuarios por operación'),
  action: z.enum(['activate', 'deactivate', 'set_role']),
  role: z.enum(USER_ROLES).optional(),
})

/**
 * PATCH /api/admin/users/bulk
 *
 * Applies a bulk action to multiple users at once.
 * Supported actions: activate, deactivate, set_role.
 * Limited to 100 users per request for safety.
 */
export default defineEventHandler(async (event) => {
  const auth = requireRole(event, 'admin')

  const body = await readBody(event)
  const parsed = bulkUpdateSchema.safeParse(body)

  if (!parsed.success) {
    throw createValidationError(parsed.error)
  }

  const { ids, action, role } = parsed.data

  if (action === 'set_role' && !role) {
    throw createBadRequestError('Se requiere el campo "role" para la acción set_role')
  }

  // Prevent admin from deactivating themselves
  if (action === 'deactivate' && ids.includes(auth.sub)) {
    throw createBadRequestError('No puedes desactivarte a ti mismo')
  }

  let update: Record<string, unknown>
  let actionLabel: string

  switch (action) {
    case 'activate':
      update = { isActive: true }
      actionLabel = 'activó'
      break
    case 'deactivate':
      update = { isActive: false }
      actionLabel = 'desactivó'
      break
    case 'set_role':
      update = { role }
      actionLabel = `cambió rol a ${role}`
      break
  }

  const result = await User.updateMany(
    { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } },
    { $set: update },
  )

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'update',
    resource: 'user',
    details: `Admin ${actionLabel} ${result.modifiedCount} usuario(s) en lote`,
  })

  return ok({
    matched: result.matchedCount,
    modified: result.modifiedCount,
  })
})
