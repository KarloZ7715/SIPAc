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
    institution?: string
    eventOrJournal?: string
    date?: Date
  },
) {
  if (productType === 'article') {
    return { journalName: extracted.eventOrJournal }
  }

  if (productType === 'conference_paper') {
    return {
      eventName: extracted.eventOrJournal,
      eventDate: extracted.date,
    }
  }

  if (productType === 'thesis') {
    return {
      university: extracted.institution,
      approvalDate: extracted.date,
    }
  }

  if (productType === 'certificate') {
    return {
      issuingEntity: extracted.institution,
      issueDate: extracted.date,
      relatedEvent: extracted.eventOrJournal,
    }
  }

  if (productType === 'research_project') {
    return {
      startDate: extracted.date,
    }
  }

  return {}
}

function normalizeProcessingError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Error interno durante el procesamiento'
  return message.slice(0, 1000)
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

    if (!ocrResult.text) {
      throw new Error('No fue posible extraer texto del documento')
    }

    const extractedEntities = await extractAcademicEntities({
      text: ocrResult.text,
      productType: uploadedFile.productType,
      extractionSource: ocrResult.provider,
    })

    const existingProduct = await AcademicProduct.findOne({
      sourceFile: uploadedFile._id,
      isDeleted: false,
    })

    const manualMetadata = {
      title: extractedEntities.title,
      authors: extractedEntities.authors,
      institution: extractedEntities.institution,
      date: extractedEntities.date,
      doi: extractedEntities.doi,
      keywords: extractedEntities.keywords,
    }

    const productPayload = {
      productType: uploadedFile.productType,
      owner: uploadedFile.uploadedBy,
      sourceFile: uploadedFile._id,
      extractedEntities,
      manualMetadata,
      ...buildProductSpecificFields(uploadedFile.productType, extractedEntities),
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
    uploadedFile.processingError = undefined
    uploadedFile.rawExtractedText = ocrResult.text
    uploadedFile.ocrProvider = ocrResult.provider
    uploadedFile.ocrConfidence = ocrResult.confidence
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
