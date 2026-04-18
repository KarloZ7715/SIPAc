import mongoose from 'mongoose'
import User from '~~/server/models/User'
import { updateProfileSchema } from '~~/server/utils/schemas/auth'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const body = await readBody(event)
  const parsed = updateProfileSchema.safeParse(body)

  if (!parsed.success) {
    throw createValidationError(parsed.error)
  }

  const updates = parsed.data
  const hasAny = Object.values(updates).some((v) => v !== undefined && v !== '')
  if (!hasAny) {
    throw createValidationError({
      issues: [{ path: [], message: 'Se debe enviar al menos un campo para actualizar' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  const user = await User.findById(auth.sub)
  if (!user) {
    throw createNotFoundError('Usuario')
  }

  if (updates.firstName !== undefined) user.firstName = updates.firstName
  if (updates.middleName !== undefined) user.middleName = updates.middleName || undefined
  if (updates.lastName !== undefined) user.lastName = updates.lastName
  if (updates.secondLastName !== undefined)
    user.secondLastName = updates.secondLastName || undefined
  if (updates.program !== undefined) user.program = updates.program || undefined

  // Marca que el usuario revisó los nombres (cierra el banner de migración)
  if (
    updates.firstName !== undefined ||
    updates.middleName !== undefined ||
    updates.lastName !== undefined ||
    updates.secondLastName !== undefined
  ) {
    user.namesReviewedAt = new Date()
  }

  await user.save()

  const changedFields = Object.keys(updates)
    .filter((k) => updates[k as keyof typeof updates] !== undefined)
    .join(', ')
  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'update',
    resource: 'user',
    resourceId: user._id,
    details: `Usuario actualizó perfil: ${changedFields}`,
  })

  return ok({ user: user.toJSON() })
})
