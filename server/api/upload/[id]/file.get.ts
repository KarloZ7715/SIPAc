import mongoose from 'mongoose'
import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import { openGridFsDownloadStream } from '~~/server/services/storage/gridfs'
import { createAuthorizationError, createNotFoundError } from '~~/server/utils/errors'

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
  let canAccessFile = isOwner || auth.role === 'admin'

  if (!canAccessFile) {
    const confirmedSourceExists = await AcademicProduct.exists({
      sourceFile: uploadedFile._id,
      reviewStatus: 'confirmed',
      isDeleted: false,
    })

    canAccessFile = Boolean(confirmedSourceExists)
  }

  if (!canAccessFile) {
    throw createAuthorizationError()
  }

  const query = getQuery(event)
  const shouldDownload = query.download === '1' || query.download === 'true'

  setHeader(event, 'Content-Type', uploadedFile.mimeType)
  setHeader(
    event,
    'Content-Disposition',
    `${shouldDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(uploadedFile.originalFilename)}`,
  )
  setHeader(event, 'Cache-Control', 'private, max-age=60')

  return sendStream(event, openGridFsDownloadStream(uploadedFile.gridfsFileId))
})
