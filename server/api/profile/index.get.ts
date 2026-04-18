import mongoose from 'mongoose'
import type { ProfileSummaryResponse, ProductType } from '~~/app/types'
import AcademicProduct from '~~/server/models/AcademicProduct'
import User from '~~/server/models/User'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  if (!mongoose.isValidObjectId(auth.sub)) {
    throw createAuthenticationError()
  }

  const user = await User.findById(auth.sub).lean()
  if (!user) {
    throw createNotFoundError('Usuario')
  }

  const ownerId = new mongoose.Types.ObjectId(auth.sub)

  const [productSummaryByTypeRaw, totalOwnProducts, latestDraftsRaw] = await Promise.all([
    AcademicProduct.aggregate<{ _id: ProductType; total: number }>([
      {
        $match: {
          owner: ownerId,
          isDeleted: false,
          reviewStatus: 'confirmed',
        },
      },
      {
        $group: {
          _id: '$productType',
          total: { $sum: 1 },
        },
      },
      { $sort: { total: -1, _id: 1 } },
    ]),
    AcademicProduct.countDocuments({
      owner: ownerId,
      isDeleted: false,
      reviewStatus: 'confirmed',
    }),
    AcademicProduct.find({
      owner: ownerId,
      isDeleted: false,
      reviewStatus: 'draft',
    })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select(
        'productType reviewStatus updatedAt manualMetadata.title extractedEntities.title.value',
      )
      .lean(),
  ])

  const response: ProfileSummaryResponse = {
    user: {
      _id: user._id.toString(),
      fullName: user.fullName,
      firstName: user.firstName ?? undefined,
      middleName: user.middleName ?? undefined,
      lastName: user.lastName ?? undefined,
      secondLastName: user.secondLastName ?? undefined,
      namesReviewedAt: user.namesReviewedAt ? user.namesReviewedAt.toISOString() : null,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      program: user.program,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      preferences: {
        defaultLanding: user.preferences?.defaultLanding ?? 'dashboard',
      },
      emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      pendingEmail: user.pendingEmail ?? null,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      googleId: user.googleId ?? null,
      createdAt: user.createdAt.toISOString(),
    },
    totalOwnProducts,
    productSummaryByType: productSummaryByTypeRaw.map((item) => ({
      productType: item._id,
      total: item.total,
    })),
    latestDrafts: latestDraftsRaw.map((draft) => ({
      _id: draft._id.toString(),
      productType: draft.productType,
      reviewStatus: draft.reviewStatus,
      updatedAt: draft.updatedAt.toISOString(),
      title: draft.manualMetadata?.title ?? draft.extractedEntities?.title?.value ?? undefined,
    })),
  }

  return ok(response)
})
