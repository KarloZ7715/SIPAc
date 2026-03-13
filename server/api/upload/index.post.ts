import User from '~~/server/models/User'
import UploadedFile from '~~/server/models/UploadedFile'
import { processUploadedFile } from '~~/server/services/upload/process-uploaded-file'
import { uploadBufferToGridFs } from '~~/server/services/storage/gridfs'
import { logAudit } from '~~/server/utils/audit'
import { createNotFoundError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'
import {
  detectAllowedMimeType,
  parseUploadMultipartRequest,
  validateUploadedBinary,
} from '~~/server/utils/upload'

export default defineEventHandler(async (event) => {
  const auth = requireRole(event, 'docente')

  const { file, metadata } = await parseUploadMultipartRequest(event)
  const mimeType = await detectAllowedMimeType(file.data)
  validateUploadedBinary(mimeType, file.data.byteLength)

  const user = await User.findById(auth.sub).select('fullName email').lean()
  if (!user) {
    throw createNotFoundError('Usuario')
  }

  const gridfsFileId = await uploadBufferToGridFs({
    buffer: file.data,
    filename: file.filename,
    contentType: mimeType,
    metadata: {
      uploadedBy: auth.sub,
      ...(metadata.productType ? { productType: metadata.productType } : {}),
      originalContentType: file.type ?? null,
    },
  })

  const uploadedFile = await UploadedFile.create({
    uploadedBy: auth.sub,
    originalFilename: file.filename,
    gridfsFileId,
    ...(metadata.productType ? { productType: metadata.productType } : {}),
    mimeType,
    fileSizeBytes: file.data.byteLength,
    processingStatus: 'pending',
  })

  await logAudit(event, {
    userId: auth.sub,
    userName: user.fullName,
    action: 'create',
    resource: 'uploaded_file',
    resourceId: uploadedFile._id,
    details: `Carga de archivo ${file.filename}`,
  })

  event.waitUntil(processUploadedFile(uploadedFile._id.toString()))

  setResponseStatus(event, 202)
  return ok({ uploadedFile: uploadedFile.toJSON() })
})
