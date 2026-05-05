import type { MultiPartData } from 'h3'
import { fileTypeFromBuffer } from 'file-type'
import type { AllowedMimeType, UploadMetadataDTO } from '~~/app/types'
import { ALLOWED_MIME_TYPES } from '~~/app/types'
import { uploadMetadataSchema, fileValidationSchema } from '~~/server/utils/schemas'
import {
  createBadRequestError,
  createPayloadTooLargeError,
  createValidationError,
} from '~~/server/utils/errors'

interface ParsedUploadRequest {
  file: MultiPartData & { filename: string }
  metadata: UploadMetadataDTO
}

const LEGACY_OFFICE_MIME_BY_EXTENSION: Record<string, AllowedMimeType> = {
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
}

function normalizeMimeType(raw: string | null | undefined): string {
  return raw?.split(';')[0]?.trim().toLowerCase() ?? ''
}

function resolveLegacyOfficeMimeByFilename(
  filename: string | null | undefined,
): AllowedMimeType | null {
  if (!filename) {
    return null
  }

  const normalized = filename.trim().toLowerCase()
  const dot = normalized.lastIndexOf('.')
  if (dot === -1) {
    return null
  }

  const extension = normalized.slice(dot + 1)
  return LEGACY_OFFICE_MIME_BY_EXTENSION[extension] ?? null
}

function resolveLegacyOfficeMimeFromDeclaredType(
  raw: string | null | undefined,
): AllowedMimeType | null {
  const mime = normalizeMimeType(raw)
  if (mime === 'application/msword') return 'application/msword'
  if (mime === 'application/vnd.ms-excel') return 'application/vnd.ms-excel'
  if (mime === 'application/vnd.ms-powerpoint') return 'application/vnd.ms-powerpoint'
  return null
}

function readTextPart(part: MultiPartData | undefined) {
  return part?.data.toString('utf8').trim() ?? ''
}

function readOptionalTextPart(part: MultiPartData | undefined) {
  const value = readTextPart(part)
  return value.length > 0 ? value : undefined
}

function getNamedPart(parts: MultiPartData[], name: string) {
  return parts.find((part) => part.name === name)
}

export async function parseUploadMultipartRequest(
  event: Parameters<typeof readMultipartFormData>[0],
) {
  const parts = await readMultipartFormData(event)

  if (!parts?.length) {
    throw createBadRequestError('Debes enviar un formulario multipart válido')
  }

  const filePart = parts.find((part) => part.name === 'file' && part.filename)
  if (!filePart?.filename) {
    throw createBadRequestError('El archivo es obligatorio')
  }

  const metadataResult = uploadMetadataSchema.safeParse({
    productType: readOptionalTextPart(getNamedPart(parts, 'productType')),
    nerForceSingleDocument: readOptionalTextPart(getNamedPart(parts, 'nerForceSingleDocument')),
  })

  if (!metadataResult.success) {
    throw createValidationError(metadataResult.error)
  }

  return {
    file: filePart as MultiPartData & { filename: string },
    metadata: metadataResult.data,
  } satisfies ParsedUploadRequest
}

export async function detectAllowedMimeType(
  buffer: Buffer,
  context?: { filename?: string | null; declaredMimeType?: string | null },
): Promise<AllowedMimeType> {
  const detected = await fileTypeFromBuffer(buffer)
  const detectedMime = normalizeMimeType(detected?.mime)

  if (detectedMime && ALLOWED_MIME_TYPES.includes(detectedMime as AllowedMimeType)) {
    return detectedMime as AllowedMimeType
  }

  const canFallbackToLegacyOffice = !detectedMime || detectedMime === 'application/x-cfb'
  if (canFallbackToLegacyOffice) {
    const byFilename = resolveLegacyOfficeMimeByFilename(context?.filename)
    if (byFilename) {
      return byFilename
    }

    const byDeclaredType = resolveLegacyOfficeMimeFromDeclaredType(context?.declaredMimeType)
    if (byDeclaredType) {
      return byDeclaredType
    }
  }

  throw createBadRequestError(
    'Tipo de archivo no permitido. Aceptamos PDF, imágenes (JPG/PNG), Office moderno (.docx, .xlsx, .pptx, ODF) y Office binario heredado (.doc, .xls, .ppt).',
    detected ? { detectedMimeType: detected.mime } : undefined,
  )
}

export function validateUploadedBinary(mimeType: AllowedMimeType, size: number) {
  const result = fileValidationSchema.safeParse({ mimeType, size })

  if (!result.success) {
    const sizeIssue = result.error.issues.find((issue) => issue.path.includes('size'))
    if (sizeIssue) {
      throw createPayloadTooLargeError(sizeIssue.message)
    }

    throw createValidationError(result.error)
  }

  return result.data
}
