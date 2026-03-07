import mongoose from 'mongoose'
import User from '~~/server/models/User'
import { requireAuth } from '~~/server/utils/authorize'
import { createNotFoundError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createNotFoundError('Usuario')
  }

  const user = await User.findById(auth.sub)
  if (!user) {
    throw createNotFoundError('Usuario')
  }

  return ok({ user: user.toJSON() })
})
