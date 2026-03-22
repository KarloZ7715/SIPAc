import mongoose from 'mongoose'
import User from '~~/server/models/User'
import { updateUserSchema } from '~~/server/utils/schemas/user'

export default defineEventHandler(async (event) => {
  const auth = requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id || !mongoose.isValidObjectId(id)) {
    throw createNotFoundError('Usuario')
  }

  const body = await readBody(event)
  const parsed = updateUserSchema.safeParse(body)

  if (!parsed.success) {
    throw createValidationError(parsed.error)
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    throw createValidationError({
      issues: [{ path: [], message: 'Se debe enviar al menos un campo para actualizar' }],
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  const user = await User.findByIdAndUpdate(
    id,
    { $set: updates },
    { returnDocument: 'after', runValidators: true },
  ).lean()

  if (!user) {
    throw createNotFoundError('Usuario')
  }

  const changedFields = Object.keys(updates).join(', ')
  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'update',
    resource: 'user',
    resourceId: user._id,
    details: `Admin actualizó campos: ${changedFields}`,
  })

  return ok({ user })
})
