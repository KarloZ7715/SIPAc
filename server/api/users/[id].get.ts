import mongoose from 'mongoose'
import User from '~~/server/models/User'

export default defineEventHandler(async (event) => {
  requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id || !mongoose.isValidObjectId(id)) {
    throw createNotFoundError('Usuario')
  }

  const user = await User.findById(id).lean()
  if (!user) {
    throw createNotFoundError('Usuario')
  }

  return ok({ user })
})
