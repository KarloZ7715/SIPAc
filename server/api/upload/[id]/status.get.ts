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

  const academicProducts = await AcademicProduct.find({
    sourceFile: uploadedFile._id,
    isDeleted: false,
  })
    .sort({ segmentIndex: 1 })
    .select('_id reviewStatus segmentIndex')
    .lean()

  const primary = academicProducts[0]

  return ok({
    processingStatus: uploadedFile.processingStatus,
    processingError: uploadedFile.processingError ?? undefined,
    rawExtractedText: uploadedFile.rawExtractedText ?? undefined,
    ocrProvider: uploadedFile.ocrProvider ?? undefined,
    ocrModel: uploadedFile.ocrModel ?? undefined,
    ocrConfidence: uploadedFile.ocrConfidence ?? undefined,
    nerProvider: uploadedFile.nerProvider ?? undefined,
    nerModel: uploadedFile.nerModel ?? undefined,
    nerAttemptTrace: uploadedFile.nerAttemptTrace ?? [],
    documentClassification: uploadedFile.documentClassification ?? undefined,
    documentClassificationSource: uploadedFile.documentClassificationSource ?? undefined,
    classificationConfidence: uploadedFile.classificationConfidence ?? undefined,
    classificationRationale: uploadedFile.classificationRationale ?? undefined,
    processingAttempt: uploadedFile.processingAttempt ?? 0,
    processingStartedAt: uploadedFile.processingStartedAt?.toISOString(),
    ocrCompletedAt: uploadedFile.ocrCompletedAt?.toISOString(),
    nerStartedAt: uploadedFile.nerStartedAt?.toISOString(),
    processingCompletedAt: uploadedFile.processingCompletedAt?.toISOString(),
    academicProductId: primary?._id.toString(),
    academicProductIds: academicProducts.map((p) => p._id.toString()),
    sourceWorkCount: uploadedFile.sourceWorkCount ?? academicProducts.length,
    nerForceSingleDocument: uploadedFile.nerForceSingleDocument ?? false,
    reviewStatus: primary?.reviewStatus,
  })
})
