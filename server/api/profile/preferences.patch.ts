import mongoose from 'mongoose'
import User from '~~/server/models/User'
import { updatePreferencesSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const body = await readBody(event)
  const parsed = updatePreferencesSchema.safeParse(body)
  if (!parsed.success) {
    throw createValidationError(parsed.error)
  }

  const user = await User.findByIdAndUpdate(
    auth.sub,
    { $set: { preferences: parsed.data } },
    { returnDocument: 'after', runValidators: true },
  ).lean()

  if (!user) {
    throw createNotFoundError('Usuario')
  }

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'update',
    resource: 'user',
    resourceId: user._id,
    details: `Preferencias actualizadas: defaultLanding=${parsed.data.defaultLanding}`,
  })

  return ok({ preferences: user.preferences })
})
