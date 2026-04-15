import type { Types } from 'mongoose'
import AcademicProduct from '~~/server/models/AcademicProduct'
import type { ProductDashboardSummary } from '~~/app/types'
import { ok } from '~~/server/utils/response'
import { buildDashboardRepositoryMatch } from '~~/server/utils/dashboard-repository-match'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const query = getQuery(event)
  const { match, from, to } = buildDashboardRepositoryMatch(auth, query as Record<string, unknown>)

  const [totals, byType, byOwner, byYear] = await Promise.all([
    AcademicProduct.aggregate<{ totalConfirmedProducts: number; totalOwners: number }>([
      { $match: match },
      {
        $group: {
          _id: null,
          totalConfirmedProducts: { $sum: 1 },
          owners: { $addToSet: '$owner' },
        },
      },
      {
        $project: {
          _id: 0,
          totalConfirmedProducts: 1,
          totalOwners: { $size: '$owners' },
        },
      },
    ]),
    AcademicProduct.aggregate<{
      _id: ProductDashboardSummary['byType'][number]['productType']
      total: number
    }>([
      { $match: match },
      { $group: { _id: '$productType', total: { $sum: 1 } } },
      { $sort: { total: -1, _id: 1 } },
    ]),
    AcademicProduct.aggregate<{ _id: Types.ObjectId; total: number; ownerName?: string }>([
      { $match: match },
      { $group: { _id: '$owner', total: { $sum: 1 } } },
      { $sort: { total: -1, _id: 1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $project: {
          total: 1,
          ownerName: { $ifNull: [{ $arrayElemAt: ['$owner.fullName', 0] }, 'Usuario'] },
        },
      },
    ]),
    AcademicProduct.aggregate<{ _id: number; total: number }>([
      { $match: match },
      {
        $addFields: {
          effectiveDate: { $ifNull: ['$manualMetadata.date', '$extractedEntities.date.value'] },
        },
      },
      { $match: { effectiveDate: { $type: 'date' } } },
      { $group: { _id: { $year: '$effectiveDate' }, total: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ])

  const totalsRow = totals[0] ?? { totalConfirmedProducts: 0, totalOwners: 0 }
  const payload: ProductDashboardSummary = {
    totalConfirmedProducts: totalsRow.totalConfirmedProducts,
    totalOwners: totalsRow.totalOwners,
    dateRange: {
      from: from?.toISOString(),
      to: to?.toISOString(),
    },
    byType: byType.map((item) => ({
      productType: item._id,
      total: item.total,
    })),
    byOwner: byOwner.map((item) => ({
      ownerId: item._id.toString(),
      ownerName: item.ownerName ?? 'Usuario',
      total: item.total,
    })),
    byYear: byYear.map((item) => ({
      year: item._id,
      total: item.total,
    })),
  }

  return ok(payload)
})
