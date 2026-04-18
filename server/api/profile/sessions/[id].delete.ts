import mongoose from 'mongoose'
import Session from '~~/server/models/Session'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!mongoose.isValidObjectId(auth.sub) || !id || !mongoose.isValidObjectId(id)) {
    throw createNotFoundError('Sesión')
  }

  const session = await Session.findOne({ _id: id, userId: auth.sub })
  if (!session || session.revokedAt) {
    throw createNotFoundError('Sesión')
  }

  session.revokedAt = new Date()
  session.revokedReason = 'user'
  await session.save()

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'delete',
    resource: 'session',
    resourceId: session._id,
    details: 'Sesión revocada por el usuario',
  })

  return ok({ message: 'Sesión cerrada' })
})
