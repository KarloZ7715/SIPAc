import type { DatabaseId } from './database'
import type { ProductReviewStatus, ProductType } from './academic-product'

export const PROCESSING_STATUSES = ['pending', 'processing', 'completed', 'error'] as const
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number]

/** OOXML + ODF que `file-type` distingue por firma (sin CFB heredado .doc/.xls). */
export const STRUCTURED_OFFICE_MIME_TYPES = [
  'application/vnd.ms-powerpoint.slideshow.macroenabled.12',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'application/vnd.openxmlformats-officedocument.presentationml.template',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.ms-excel.template.macroenabled.12',
  'application/vnd.oasis.opendocument.text-template',
  'application/vnd.oasis.opendocument.spreadsheet-template',
  'application/vnd.oasis.opendocument.presentation-template',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.ms-word.document.macroenabled.12',
  'application/vnd.ms-word.template.macroenabled.12',
  'application/vnd.ms-powerpoint.template.macroenabled.12',
  'application/vnd.ms-powerpoint.presentation.macroenabled.12',
] as const

export type StructuredOfficeMimeType = (typeof STRUCTURED_OFFICE_MIME_TYPES)[number]

export const CORE_UPLOAD_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const

export const ALLOWED_MIME_TYPES = [
  ...CORE_UPLOAD_MIME_TYPES,
  ...STRUCTURED_OFFICE_MIME_TYPES,
] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export function resolveStructuredOfficeMimeType(mime: string): StructuredOfficeMimeType | null {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? ''
  const hit = STRUCTURED_OFFICE_MIME_TYPES.find((m) => m.toLowerCase() === base)
  return hit ?? null
}

export function isStructuredOfficeMimeType(mime: string): boolean {
  return resolveStructuredOfficeMimeType(mime) != null
}

export const OCR_PROVIDERS = [
  'pdfjs_native',
  'gemini_vision',
  'mistral_ocr_3',
  'office_native',
] as const
export type OcrProvider = (typeof OCR_PROVIDERS)[number]

export const DOCUMENT_CLASSIFICATIONS = ['academic', 'non_academic', 'uncertain'] as const
export type DocumentClassification = (typeof DOCUMENT_CLASSIFICATIONS)[number]

export const DOCUMENT_CLASSIFICATION_SOURCES = ['heuristic', 'llm', 'hybrid'] as const
export type DocumentClassificationSource = (typeof DOCUMENT_CLASSIFICATION_SOURCES)[number]

export const NER_PROVIDERS = ['cerebras', 'gemini', 'groq', 'openrouter', 'nvidia'] as const
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
  nerForceSingleDocument?: boolean
  sourceWorkCount?: number
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
  nerForceSingleDocument?: 'true' | 'false' | '1' | '0' | ''
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
  academicProductIds?: string[]
  sourceWorkCount?: number
  nerForceSingleDocument?: boolean
  reviewStatus?: ProductReviewStatus
}

export interface UploadedFileWorkspacePublic extends UploadedFilePublic, UploadedFileStatusDTO {}
