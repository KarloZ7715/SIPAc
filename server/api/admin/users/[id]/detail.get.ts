import mongoose from 'mongoose'
import User from '~~/server/models/User'
import AcademicProduct from '~~/server/models/AcademicProduct'
import AuditLog from '~~/server/models/AuditLog'
import Session from '~~/server/models/Session'
import { toAuditLogPublic } from '~~/server/utils/audit'
import { requireRole } from '~~/server/utils/authorize'
import { createNotFoundError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'

/**
 * GET /api/admin/users/:id/detail
 *
 * Returns extended user detail for the admin drawer:
 * - Full user document
 * - Product counts by status
 * - Last 5 audit log entries by this user
 * - Most recent session info
 */
export default defineEventHandler(async (event) => {
  requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id || !mongoose.isValidObjectId(id)) {
    throw createNotFoundError('Usuario')
  }

  const objectId = new mongoose.Types.ObjectId(id)

  const [user, productStats, recentActivity, lastSession] = await Promise.all([
    User.findById(id).lean(),

    AcademicProduct.aggregate([
      { $match: { userId: objectId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          confirmed: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$reviewStatus', 'confirmed'] }, { $eq: ['$isDeleted', false] }] },
                1,
                0,
              ],
            },
          },
          drafts: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$reviewStatus', 'draft'] }, { $eq: ['$isDeleted', false] }] },
                1,
                0,
              ],
            },
          },
          deleted: {
            $sum: { $cond: ['$isDeleted', 1, 0] },
          },
        },
      },
    ]),

    AuditLog.find({ userId: objectId }).sort({ createdAt: -1 }).limit(5).lean(),

    Session.findOne({ userId: objectId, revokedAt: null }).sort({ lastSeenAt: -1 }).lean(),
  ])

  if (!user) {
    throw createNotFoundError('Usuario')
  }

  const products = productStats[0] ?? { total: 0, confirmed: 0, drafts: 0, deleted: 0 }

  return ok({
    user: {
      _id: user._id?.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      program: user.program,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      createdAt: user.createdAt?.toISOString(),
    },
    products: {
      total: products.total,
      confirmed: products.confirmed,
      drafts: products.drafts,
      deleted: products.deleted,
    },
    recentActivity: recentActivity.map((log) => toAuditLogPublic(log)),
    lastSession: lastSession
      ? {
          lastSeenAt: lastSession.lastSeenAt?.toISOString() ?? null,
          ipAddress: lastSession.ipAddress ?? null,
        }
      : null,
  })
})
