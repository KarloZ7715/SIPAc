import mongoose from 'mongoose'
import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import { createAuthorizationError, createNotFoundError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const uploadId = event.context.params?.id

  if (!uploadId || !mongoose.isValidObjectId(uploadId)) {
    throw createNotFoundError('Archivo')
  }

  const uploadedFile = await UploadedFile.findById(uploadId)
  if (!uploadedFile || uploadedFile.isDeleted) {
    throw createNotFoundError('Archivo')
  }

  const isOwner = uploadedFile.uploadedBy.toString() === auth.sub
  if (!isOwner && auth.role !== 'admin') {
    throw createAuthorizationError()
  }

  const academicProduct = await AcademicProduct.findOne({
    sourceFile: uploadedFile._id,
    isDeleted: false,
  }).select('_id')

  return ok({
    processingStatus: uploadedFile.processingStatus,
    processingError: uploadedFile.processingError ?? undefined,
    rawExtractedText: uploadedFile.rawExtractedText ?? undefined,
    ocrProvider: uploadedFile.ocrProvider ?? undefined,
    ocrConfidence: uploadedFile.ocrConfidence ?? undefined,
    academicProductId: academicProduct?._id.toString(),
  })
})
