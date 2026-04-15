import type { OcrProvider } from '~~/app/types'
import { OCR_PROVIDERS } from '~~/app/types/uploaded-file'
import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import { readGridFsFileToBuffer } from '~~/server/services/storage/gridfs'
import { extractDocumentText } from '~~/server/services/ocr/extract-document-text'
import {
  classifyDocumentForNer,
  extractAcademicEntities,
  extractProductSpecificMetadata,
} from '~~/server/services/ner/extract-academic-entities'
import { validateProductSpecificMetadata } from '~~/server/services/ner/product-specific-validation'
import { buildProductSpecificFields } from '~~/server/services/upload/process-uploaded-file'
import { getWorkspaceClassificationRejectionMessage } from '~~/server/utils/workspace-classification-gate'
import {
  createAuthorizationError,
  createBadRequestError,
  createNotFoundError,
} from '~~/server/utils/errors'
import { classifyPipelineError, logPipelineEvent } from '~~/server/utils/pipeline-observability'

function resolveOwnerId(owner: unknown): string {
  if (owner && typeof owner === 'object' && 'toString' in owner) {
    return String((owner as { toString: () => string }).toString())
  }
  return String(owner)
}

function resolveOcrProvider(raw: unknown): OcrProvider {
  if (typeof raw === 'string' && (OCR_PROVIDERS as readonly string[]).includes(raw)) {
    return raw as OcrProvider
  }
  return 'pdfjs_native'
}

export async function reextractProductNer(input: {
  productId: string
  userId: string
  /** Permite que un administrador re-extraiga productos de otros usuarios. */
  isAdmin?: boolean
}): Promise<{ extractionConfidence: number }> {
  const product = await AcademicProduct.findOne({
    _id: input.productId,
    isDeleted: false,
  }).lean()

  if (!product) {
    throw createNotFoundError('Producto academico')
  }

  const ownerId = resolveOwnerId(product.owner)
  if (ownerId !== input.userId && !input.isAdmin) {
    throw createAuthorizationError()
  }

  const uploaded = await UploadedFile.findOne({
    _id: product.sourceFile,
    isDeleted: false,
  }).lean()

  if (!uploaded) {
    throw createNotFoundError('Archivo fuente')
  }

  const traceId = `reextract:${input.productId}:${Date.now()}`

  let fullText =
    typeof uploaded.rawExtractedText === 'string' ? uploaded.rawExtractedText.trim() : ''
  let extractionSource = resolveOcrProvider(uploaded.ocrProvider)

  // Preferir texto ya OCR para no repetir extracción de archivo (coste y latencia).
  if (!fullText) {
    const fileBuffer = await readGridFsFileToBuffer(uploaded.gridfsFileId)
    const ocrResult = await extractDocumentText({
      buffer: fileBuffer,
      mimeType: uploaded.mimeType,
      traceId,
      documentId: String(uploaded._id),
    })
    if (!ocrResult.text?.trim()) {
      throw createBadRequestError('No fue posible obtener texto del documento para re-extraer.')
    }
    fullText = ocrResult.text
    extractionSource = ocrResult.provider
  }

  const bounds = product.segmentBounds
  const segmentText =
    typeof bounds?.textStart === 'number' && typeof bounds?.textEnd === 'number'
      ? fullText.slice(bounds.textStart, bounds.textEnd)
      : fullText

  if (!segmentText.trim()) {
    throw createBadRequestError(
      'El fragmento de texto del producto está vacío; no se puede re-extraer.',
    )
  }

  const classificationProfile = await classifyDocumentForNer(fullText)
  const classificationRejection = getWorkspaceClassificationRejectionMessage(classificationProfile)
  if (classificationRejection) {
    throw createBadRequestError(classificationRejection)
  }

  const segmentCount = Math.max(1, uploaded.sourceWorkCount ?? 1)

  const extractedEntities = await extractAcademicEntities({
    text: segmentText,
    extractionSource,
    ocrBlocks: [],
    traceId,
    documentId: String(uploaded._id),
    classificationProfile,
    segmentMeta: { segmentIndex: product.segmentIndex ?? 0, segmentCount },
  })

  if (extractedEntities.productType !== product.productType) {
    throw createBadRequestError(
      'La re-extracción sugiere un tipo de documento distinto al de la ficha; ajusta el tipo manualmente o vuelve a subir el archivo.',
    )
  }

  let productSpecificMetadata: Record<string, unknown> = {}
  try {
    productSpecificMetadata = await extractProductSpecificMetadata({
      text: segmentText,
      productType: product.productType,
      commonExtraction: {
        authors: extractedEntities.authors,
        title: extractedEntities.title,
        institution: extractedEntities.institution,
        date: extractedEntities.date,
        doi: extractedEntities.doi,
        eventOrJournal: extractedEntities.eventOrJournal,
      },
      traceId,
      documentId: String(uploaded._id),
    })
  } catch (error) {
    const classified = classifyPipelineError(error)
    logPipelineEvent({
      traceId,
      documentId: String(uploaded._id),
      stage: 'ner',
      event: 'product_specific_extraction_failed',
      provider: extractedEntities.nerProvider,
      modelId: extractedEntities.nerModel,
      errorType: classified.errorType,
      errorMessage: classified.errorMessage,
      metadata: {
        productType: product.productType,
        scope: 'reextract',
      },
    })
  }

  const validatedProductSpecific = validateProductSpecificMetadata({
    productType: product.productType,
    metadata: productSpecificMetadata,
  })

  const specificFields = buildProductSpecificFields(
    product.productType,
    extractedEntities,
    validatedProductSpecific.sanitized,
  )

  const updated = await AcademicProduct.findByIdAndUpdate(
    product._id,
    {
      $set: {
        extractedEntities,
        ...specificFields,
      },
    },
    { new: true, runValidators: true },
  )

  if (!updated) {
    throw createNotFoundError('Producto academico')
  }

  return { extractionConfidence: updated.extractedEntities.extractionConfidence }
}
