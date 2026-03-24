import mongoose from 'mongoose'
import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import { buildProductWorkspaceDraft } from '~~/server/utils/product'
import { createAuthorizationError, createNotFoundError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const productId = getRouterParam(event, 'id')
  if (!productId || !mongoose.isValidObjectId(productId)) {
    throw createNotFoundError('Producto academico')
  }

  const product = await AcademicProduct.findById(productId).lean()
  if (!product || product.isDeleted) {
    throw createNotFoundError('Producto academico')
  }

  const isOwner = product.owner.toString() === auth.sub
  const canEdit = isOwner || auth.role === 'admin'
  const canView = canEdit || product.reviewStatus === 'confirmed'

  if (!canView) {
    throw createAuthorizationError()
  }

  const uploadedFile = await UploadedFile.findById(product.sourceFile).lean()
  if (!uploadedFile || uploadedFile.isDeleted) {
    throw createNotFoundError('Archivo')
  }

  const siblingProducts = await AcademicProduct.find({
    sourceFile: product.sourceFile,
    isDeleted: false,
  })
    .sort({ segmentIndex: 1 })
    .select('_id')
    .lean()

  return ok({
    draft: buildProductWorkspaceDraft(
      product,
      {
        ...uploadedFile,
        academicProductIds: siblingProducts.map((p) => p._id),
        sourceWorkCount: uploadedFile.sourceWorkCount ?? siblingProducts.length,
      },
      {
        canView: true,
        canEdit,
        canDelete: canEdit,
      },
    ),
  })
})
