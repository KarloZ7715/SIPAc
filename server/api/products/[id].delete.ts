import mongoose from 'mongoose'
import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import { logAudit } from '~~/server/utils/audit'
import { createAuthorizationError, createNotFoundError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const productId = getRouterParam(event, 'id')
  if (!productId || !mongoose.isValidObjectId(productId)) {
    throw createNotFoundError('Producto academico')
  }

  const product = await AcademicProduct.findById(productId)
  if (!product || product.isDeleted) {
    throw createNotFoundError('Producto academico')
  }

  const isOwner = product.owner.toString() === auth.sub
  if (!isOwner && auth.role !== 'admin') {
    throw createAuthorizationError()
  }

  product.isDeleted = true
  product.deletedAt = new Date()
  await product.save()

  const remainingProducts = await AcademicProduct.countDocuments({
    sourceFile: product.sourceFile,
    isDeleted: false,
  })

  if (remainingProducts === 0) {
    await UploadedFile.findByIdAndUpdate(product.sourceFile, {
      isDeleted: true,
      deletedAt: new Date(),
    })
  }

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'delete',
    resource: 'academic_product',
    resourceId: product._id,
    details: `Eliminacion de producto academico ${product._id.toString()} (tipo: ${product.productType})`,
  })

  return ok({ deleted: true })
})
