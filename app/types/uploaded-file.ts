import type { DatabaseId } from './database'
import type { ProductReviewStatus, ProductType } from './academic-product'

export const PROCESSING_STATUSES = ['pending', 'processing', 'completed', 'error'] as const
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number]

export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export const OCR_PROVIDERS = ['pdfjs_native', 'gemini_vision', 'mistral_ocr_3'] as const
export type OcrProvider = (typeof OCR_PROVIDERS)[number]

export const DOCUMENT_CLASSIFICATIONS = ['academic', 'non_academic', 'uncertain'] as const
export type DocumentClassification = (typeof DOCUMENT_CLASSIFICATIONS)[number]

export const DOCUMENT_CLASSIFICATION_SOURCES = ['heuristic', 'llm', 'hybrid'] as const
export type DocumentClassificationSource = (typeof DOCUMENT_CLASSIFICATION_SOURCES)[number]

export const NER_PROVIDERS = ['cerebras', 'gemini', 'groq'] as const
export type NerProvider = (typeof NER_PROVIDERS)[number]

export const NER_ATTEMPT_SCOPES = ['extraction_first_pass', 'extraction_second_pass'] as const
export type NerAttemptScope = (typeof NER_ATTEMPT_SCOPES)[number]

export const NER_ATTEMPT_STATUSES = ['succeeded', 'failed'] as const
export type NerAttemptStatus = (typeof NER_ATTEMPT_STATUSES)[number]

export interface NerAttemptTraceEntry {
  scope: NerAttemptScope
  attempt: number
  provider: NerProvider
  modelId: string
  status: NerAttemptStatus
  durationMs: number
  errorType?: string
  errorMessage?: string
}

export const MAX_FILE_SIZE_BYTES = 20_971_520 // 20 MB

export interface IUploadedFile {
  _id: DatabaseId
  uploadedBy: DatabaseId
  originalFilename: string
  gridfsFileId: DatabaseId
  productType?: ProductType
  mimeType: AllowedMimeType
  fileSizeBytes: number
  processingStatus: ProcessingStatus
  processingError?: string
  rawExtractedText?: string
  ocrProvider?: OcrProvider
  ocrModel?: string
  ocrConfidence?: number
  nerProvider?: NerProvider
  nerModel?: string
  nerAttemptTrace?: NerAttemptTraceEntry[]
  documentClassification?: DocumentClassification
  documentClassificationSource?: DocumentClassificationSource
  classificationConfidence?: number
  classificationRationale?: string
  processingAttempt?: number
  processingStartedAt?: Date
  ocrCompletedAt?: Date
  nerStartedAt?: Date
  processingCompletedAt?: Date
  isDeleted: boolean
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface UploadedFilePublic {
  _id: string
  originalFilename: string
  productType?: ProductType
  mimeType: AllowedMimeType
  fileSizeBytes: number
  processingStatus: ProcessingStatus
  processingError?: string
  ocrProvider?: OcrProvider
  ocrConfidence?: number
  createdAt: string
}

export interface UploadMetadataDTO {
  productType?: ProductType
}

export interface UploadedFileStatusDTO {
  processingStatus: ProcessingStatus
  processingError?: string
  rawExtractedText?: string
  ocrProvider?: OcrProvider
  ocrModel?: string
  ocrConfidence?: number
  nerProvider?: NerProvider
  nerModel?: string
  nerAttemptTrace?: NerAttemptTraceEntry[]
  documentClassification?: DocumentClassification
  documentClassificationSource?: DocumentClassificationSource
  classificationConfidence?: number
  classificationRationale?: string
  processingAttempt?: number
  processingStartedAt?: string
  ocrCompletedAt?: string
  nerStartedAt?: string
  processingCompletedAt?: string
  academicProductId?: string
  reviewStatus?: ProductReviewStatus
}

export interface UploadedFileWorkspacePublic extends UploadedFilePublic, UploadedFileStatusDTO {}
