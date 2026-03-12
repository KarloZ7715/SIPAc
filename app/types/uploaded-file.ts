import type { DatabaseId } from './database'
import type { ProductType } from './academic-product'

export const PROCESSING_STATUSES = ['pending', 'processing', 'completed', 'error'] as const
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number]

export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export const OCR_PROVIDERS = ['pdfjs_native', 'gemini_vision', 'mistral_ocr_3'] as const
export type OcrProvider = (typeof OCR_PROVIDERS)[number]

export const MAX_FILE_SIZE_BYTES = 20_971_520 // 20 MB

export interface IUploadedFile {
  _id: DatabaseId
  uploadedBy: DatabaseId
  originalFilename: string
  gridfsFileId: DatabaseId
  productType: ProductType
  mimeType: AllowedMimeType
  fileSizeBytes: number
  processingStatus: ProcessingStatus
  processingError?: string
  rawExtractedText?: string
  ocrProvider?: OcrProvider
  ocrConfidence?: number
  isDeleted: boolean
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface UploadedFilePublic {
  _id: string
  originalFilename: string
  productType: ProductType
  mimeType: AllowedMimeType
  fileSizeBytes: number
  processingStatus: ProcessingStatus
  processingError?: string
  ocrProvider?: OcrProvider
  ocrConfidence?: number
  createdAt: string
}

export interface UploadMetadataDTO {
  productType: ProductType
}

export interface UploadedFileStatusDTO {
  processingStatus: ProcessingStatus
  processingError?: string
  rawExtractedText?: string
  ocrProvider?: OcrProvider
  ocrConfidence?: number
  academicProductId?: string
}
