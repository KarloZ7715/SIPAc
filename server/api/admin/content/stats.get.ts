import AcademicProduct from '~~/server/models/AcademicProduct'
import { requireRole } from '~~/server/utils/authorize'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  requireRole(event, 'admin')

  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [globalStats, typeStats, monthlyStats] = await Promise.all([
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
    AcademicProduct.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$productType',
          count: { $sum: 1 },
        },
      },
    ]),
    AcademicProduct.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: firstDayOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          createdThisMonth: { $sum: 1 },
          confirmedThisMonth: {
            $sum: { $cond: [{ $eq: ['$reviewStatus', 'confirmed'] }, 1, 0] },
          },
        },
      },
    ]),
  ])

  const stats = globalStats[0] ?? { total: 0, confirmed: 0, drafts: 0, deleted: 0 }
  const monthly = monthlyStats[0] ?? { createdThisMonth: 0, confirmedThisMonth: 0 }

  const byType = typeStats.reduce((acc: Record<string, number>, curr) => {
    acc[curr._id] = curr.count
    return acc
  }, {})

  return ok({
    total: stats.total,
    confirmed: stats.confirmed,
    drafts: stats.drafts,
    deleted: stats.deleted,
    createdThisMonth: monthly.createdThisMonth,
    confirmedThisMonth: monthly.confirmedThisMonth,
    byType,
  })
})
