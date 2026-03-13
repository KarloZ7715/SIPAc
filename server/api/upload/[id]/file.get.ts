import mongoose from 'mongoose'
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
  if (!isOwner && auth.role !== 'admin') {
    throw createAuthorizationError()
  }

  setHeader(event, 'Content-Type', uploadedFile.mimeType)
  setHeader(
    event,
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(uploadedFile.originalFilename)}`,
  )
  setHeader(event, 'Cache-Control', 'private, max-age=60')

  return sendStream(event, openGridFsDownloadStream(uploadedFile.gridfsFileId))
})
