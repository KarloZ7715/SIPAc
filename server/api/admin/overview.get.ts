import User from '~~/server/models/User'
import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import AuditLog from '~~/server/models/AuditLog'
import Session from '~~/server/models/Session'
import { toAuditLogPublic } from '~~/server/utils/audit'
import { requireRole } from '~~/server/utils/authorize'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  requireRole(event, 'admin')

  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [userStats, productStats, pipelineStats, recentLogs, activeSessions] = await Promise.all([
    // --- User KPIs (from DB, not paginated) ---
    User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
          admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          docentes: { $sum: { $cond: [{ $eq: ['$role', 'docente'] }, 1, 0] } },
        },
      },
    ]),

    // --- Academic product KPIs ---
    AcademicProduct.aggregate([
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

    // --- Pipeline health (documents stuck or failed) ---
    UploadedFile.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          pending: { $sum: { $cond: [{ $eq: ['$processingStatus', 'pending'] }, 1, 0] } },
          processing: { $sum: { $cond: [{ $eq: ['$processingStatus', 'processing'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$processingStatus', 'failed'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$processingStatus', 'completed'] }, 1, 0] } },
        },
      },
    ]),

    // --- Last 5 audit logs (real activity feed) ---
    AuditLog.find().sort({ createdAt: -1 }).limit(5).lean(),

    // --- Active sessions (last 24h) ---
    Session.countDocuments({
      revokedAt: null,
      expiresAt: { $gt: now },
      lastSeenAt: { $gte: twentyFourHoursAgo },
    }),
  ])

  const users = userStats[0] ?? { total: 0, active: 0, inactive: 0, admins: 0, docentes: 0 }
  const products = productStats[0] ?? { total: 0, confirmed: 0, drafts: 0, deleted: 0 }
  const pipeline = pipelineStats[0] ?? { pending: 0, processing: 0, failed: 0, completed: 0 }

  return ok({
    users: {
      total: users.total,
      active: users.active,
      inactive: users.inactive,
      admins: users.admins,
      docentes: users.docentes,
    },
    products: {
      total: products.total,
      confirmed: products.confirmed,
      drafts: products.drafts,
      deleted: products.deleted,
    },
    pipeline: {
      pending: pipeline.pending,
      processing: pipeline.processing,
      failed: pipeline.failed,
      completed: pipeline.completed,
    },
    activeSessions,
    recentActivity: recentLogs.map((log) => toAuditLogPublic(log)),
  })
})
