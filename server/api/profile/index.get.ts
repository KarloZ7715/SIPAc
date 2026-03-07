import mongoose from 'mongoose'
import User from '~~/server/models/User'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const user = await User.findById(auth.sub).lean()
  if (!user) {
    throw createNotFoundError('Usuario')
  }

  return ok({ user })
})
