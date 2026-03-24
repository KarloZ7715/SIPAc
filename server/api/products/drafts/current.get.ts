import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import { buildProductWorkspaceDraft } from '~~/server/utils/product'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const product = await AcademicProduct.findOne({
    owner: auth.sub,
    reviewStatus: 'draft',
    isDeleted: false,
  })
    .sort({ updatedAt: -1 })
    .lean()

  if (!product) {
    return ok({ draft: null })
  }

  const uploadedFile = await UploadedFile.findOne({
    _id: product.sourceFile,
    isDeleted: false,
  }).lean()

  if (!uploadedFile) {
    return ok({ draft: null })
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
        canEdit: true,
        canDelete: true,
      },
    ),
  })
})
