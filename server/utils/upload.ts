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

export async function detectAllowedMimeType(buffer: Buffer): Promise<AllowedMimeType> {
  const detected = await fileTypeFromBuffer(buffer)

  if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime as AllowedMimeType)) {
    throw createBadRequestError(
      'Tipo de archivo no permitido. Solo se aceptan PDF, JPG y PNG',
      detected ? { detectedMimeType: detected.mime } : undefined,
    )
  }

  return detected.mime as AllowedMimeType
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
