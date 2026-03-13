import type { ProductType } from '~~/app/types'
import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import User from '~~/server/models/User'
import { logSystemAudit } from '~~/server/utils/audit'
import { readGridFsFileToBuffer } from '~~/server/services/storage/gridfs'
import { extractDocumentText } from '~~/server/services/ocr/extract-document-text'
import { extractAcademicEntities } from '~~/server/services/ner/extract-academic-entities'
import { notifyDocumentProcessing } from '~~/server/services/notifications/notify-document-processing'

function buildProductSpecificFields(
  productType: ProductType,
  extracted: {
    institution?: { value: string }
    eventOrJournal?: { value: string }
    date?: { value: Date }
  },
) {
  if (productType === 'article') {
    return { journalName: extracted.eventOrJournal?.value }
  }

  if (productType === 'conference_paper') {
    return {
      eventName: extracted.eventOrJournal?.value,
      eventDate: extracted.date?.value,
    }
  }

  if (productType === 'thesis') {
    return {
      university: extracted.institution?.value,
      approvalDate: extracted.date?.value,
    }
  }

  if (productType === 'certificate') {
    return {
      issuingEntity: extracted.institution?.value,
      issueDate: extracted.date?.value,
      relatedEvent: extracted.eventOrJournal?.value,
    }
  }

  if (productType === 'research_project') {
    return {
      startDate: extracted.date?.value,
    }
  }

  return {}
}

function normalizeProcessingError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Error interno durante el procesamiento'
  return message.slice(0, 1000)
}

function isBlockedByDocumentPolicy(input: {
  documentClassification: 'academic' | 'non_academic' | 'uncertain'
  classificationConfidence: number
}) {
  return input.documentClassification === 'non_academic' && input.classificationConfidence >= 0.75
}

export async function processUploadedFile(uploadedFileId: string): Promise<void> {
  const uploadedFile = await UploadedFile.findById(uploadedFileId)
  if (!uploadedFile || uploadedFile.isDeleted) {
    return
  }

  if (
    uploadedFile.processingStatus === 'processing' ||
    uploadedFile.processingStatus === 'completed'
  ) {
    return
  }

  uploadedFile.processingStatus = 'processing'
  uploadedFile.processingError = undefined
  uploadedFile.processingAttempt = (uploadedFile.processingAttempt ?? 0) + 1
  uploadedFile.processingStartedAt = new Date()
  uploadedFile.ocrCompletedAt = undefined
  uploadedFile.nerStartedAt = undefined
  uploadedFile.processingCompletedAt = undefined
  uploadedFile.ocrModel = undefined
  uploadedFile.nerProvider = undefined
  uploadedFile.nerModel = undefined
  await uploadedFile.save()

  try {
    const owner = await User.findById(uploadedFile.uploadedBy).select('fullName email').lean()
    if (!owner) {
      throw new Error('El usuario propietario del documento no existe')
    }

    const fileBuffer = await readGridFsFileToBuffer(uploadedFile.gridfsFileId)
    const ocrResult = await extractDocumentText({
      buffer: fileBuffer,
      mimeType: uploadedFile.mimeType,
    })

    uploadedFile.ocrCompletedAt = new Date()

    if (!ocrResult.text) {
      throw new Error('No fue posible extraer texto del documento')
    }

    uploadedFile.nerStartedAt = new Date()

    const extractedEntities = await extractAcademicEntities({
      text: ocrResult.text,
      extractionSource: ocrResult.provider,
      ocrBlocks: ocrResult.blocks,
    })

    uploadedFile.rawExtractedText = ocrResult.text
    uploadedFile.ocrProvider = ocrResult.provider
    uploadedFile.ocrModel = ocrResult.modelId
    uploadedFile.ocrConfidence = ocrResult.confidence
    uploadedFile.nerProvider = extractedEntities.nerProvider
    uploadedFile.nerModel = extractedEntities.nerModel
    uploadedFile.documentClassification = extractedEntities.documentClassification
    uploadedFile.classificationConfidence = extractedEntities.classificationConfidence
    uploadedFile.classificationRationale = extractedEntities.classificationRationale

    if (isBlockedByDocumentPolicy(extractedEntities)) {
      const reason = 'El archivo no parece corresponder a un documento academico verificable.'

      uploadedFile.processingStatus = 'error'
      uploadedFile.processingError = reason
      uploadedFile.processingCompletedAt = new Date()
      await uploadedFile.save()

      await notifyDocumentProcessing({
        recipientId: uploadedFile.uploadedBy.toString(),
        uploadedFileId: uploadedFile._id.toString(),
        filename: uploadedFile.originalFilename,
        status: 'error',
        errorMessage: reason,
      })

      return
    }

    const detectedProductType = extractedEntities.productType

    const existingProduct = await AcademicProduct.findOne({
      sourceFile: uploadedFile._id,
      isDeleted: false,
    })

    const manualMetadata = {
      title: extractedEntities.title?.value,
      authors: extractedEntities.authors.map((a) => a.value),
      institution: extractedEntities.institution?.value,
      date: extractedEntities.date?.value,
      doi: extractedEntities.doi?.value,
      keywords: extractedEntities.keywords.map((a) => a.value),
    }

    const productPayload = {
      productType: detectedProductType,
      owner: uploadedFile.uploadedBy,
      sourceFile: uploadedFile._id,
      reviewStatus: 'draft' as const,
      extractedEntities,
      manualMetadata,
      ...buildProductSpecificFields(detectedProductType, extractedEntities),
    }

    const academicProduct = existingProduct
      ? await AcademicProduct.findByIdAndUpdate(existingProduct._id, productPayload, {
          new: true,
          runValidators: true,
        })
      : await AcademicProduct.create(productPayload)

    if (!academicProduct) {
      throw new Error('No fue posible persistir el producto academico')
    }

    uploadedFile.processingStatus = 'completed'
    uploadedFile.productType = detectedProductType
    uploadedFile.processingError = undefined
    uploadedFile.processingCompletedAt = new Date()
    await uploadedFile.save()

    await logSystemAudit({
      userId: uploadedFile.uploadedBy,
      userName: owner.fullName,
      action: existingProduct ? 'update' : 'create',
      resource: 'academic_product',
      resourceId: academicProduct._id,
      details: `Procesamiento automatico de ${uploadedFile.originalFilename}`,
    })

    await notifyDocumentProcessing({
      recipientId: uploadedFile.uploadedBy.toString(),
      uploadedFileId: uploadedFile._id.toString(),
      academicProductId: academicProduct._id.toString(),
      filename: uploadedFile.originalFilename,
      status: 'completed',
    })
  } catch (error) {
    const currentUploadedFile = await UploadedFile.findById(uploadedFileId)
    if (!currentUploadedFile || currentUploadedFile.isDeleted) {
      return
    }

    const processingError = normalizeProcessingError(error)

    currentUploadedFile.processingStatus = 'error'
    currentUploadedFile.processingError = processingError
    currentUploadedFile.processingCompletedAt = new Date()
    await currentUploadedFile.save()

    await notifyDocumentProcessing({
      recipientId: currentUploadedFile.uploadedBy.toString(),
      uploadedFileId: currentUploadedFile._id.toString(),
      filename: currentUploadedFile.originalFilename,
      status: 'error',
      errorMessage: processingError,
    })
  }
}
