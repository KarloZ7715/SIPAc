import mongoose from 'mongoose'
import { setHeader } from 'h3'
import User from '~~/server/models/User'
import AcademicProduct from '~~/server/models/AcademicProduct'
import AuditLog from '~~/server/models/AuditLog'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const ownerId = new mongoose.Types.ObjectId(auth.sub)

  const [user, products, activity] = await Promise.all([
    User.findById(auth.sub).lean(),
    AcademicProduct.find({ owner: ownerId, isDeleted: false })
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean(),
    AuditLog.find({ userId: ownerId }).sort({ createdAt: -1 }).limit(500).lean(),
  ])

  if (!user) {
    throw createNotFoundError('Usuario')
  }

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'update',
    resource: 'user',
    resourceId: user._id,
    details: 'Exportación de datos personales',
  })

  const payload = {
    generatedAt: new Date().toISOString(),
    user: {
      _id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      program: user.program,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      preferences: user.preferences ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    products: products.map((p) => ({
      _id: p._id.toString(),
      productType: p.productType,
      reviewStatus: p.reviewStatus,
      title: p.manualMetadata?.title ?? p.extractedEntities?.title?.value ?? null,
      createdAt: new Date(p.createdAt).toISOString(),
      updatedAt: new Date(p.updatedAt).toISOString(),
    })),
    activity: activity.map((log) => ({
      _id: log._id.toString(),
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId ? log.resourceId.toString() : null,
      details: log.details ?? null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent ?? null,
      createdAt: new Date(log.createdAt).toISOString(),
    })),
  }

  const filename = `sipac-perfil-${user._id.toString()}-${new Date().toISOString().slice(0, 10)}.json`
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="${filename}"`)
  return payload
})
