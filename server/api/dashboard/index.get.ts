import mongoose from 'mongoose'
import AcademicProduct from '~~/server/models/AcademicProduct'
import { PRODUCT_TYPES, type ProductDashboardSummary } from '~~/app/types'
import { ok } from '~~/server/utils/response'

function parseDateParam(value: unknown, boundary: 'start' | 'end') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  if (boundary === 'end') {
    parsed.setUTCHours(23, 59, 59, 999)
  } else {
    parsed.setUTCHours(0, 0, 0, 0)
  }

  return parsed
}

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const query = getQuery(event)
  const match: Record<string, unknown> = {
    isDeleted: false,
    reviewStatus: 'confirmed',
  }

  if (
    typeof query.productType === 'string' &&
    (PRODUCT_TYPES as readonly string[]).includes(query.productType)
  ) {
    match.productType = query.productType
  }

  if (typeof query.owner === 'string' && mongoose.isValidObjectId(query.owner)) {
    match.owner = new mongoose.Types.ObjectId(query.owner)
  }

  const from = parseDateParam(query.from, 'start')
  const to = parseDateParam(query.to, 'end')
  if (from || to) {
    match.$expr = {
      $and: [
        ...(from
          ? [
              {
                $gte: [
                  { $ifNull: ['$manualMetadata.date', '$extractedEntities.date.value'] },
                  from,
                ],
              },
            ]
          : []),
        ...(to
          ? [
              {
                $lte: [{ $ifNull: ['$manualMetadata.date', '$extractedEntities.date.value'] }, to],
              },
            ]
          : []),
      ],
    }
  }

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
    AcademicProduct.aggregate<{ _id: mongoose.Types.ObjectId; total: number; ownerName?: string }>([
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
