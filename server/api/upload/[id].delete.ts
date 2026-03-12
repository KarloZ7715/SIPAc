import mongoose from 'mongoose'
import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import { deleteFileFromGridFs } from '~~/server/services/storage/gridfs'
import { logAudit } from '~~/server/utils/audit'
import { createAuthorizationError, createNotFoundError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'

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

  uploadedFile.isDeleted = true
  uploadedFile.deletedAt = new Date()
  await uploadedFile.save()

  try {
    await deleteFileFromGridFs(uploadedFile.gridfsFileId)
  } catch (error) {
    console.error('[Upload] Error al eliminar archivo GridFS:', error)
  }

  const academicProduct = await AcademicProduct.findOne({
    sourceFile: uploadedFile._id,
    isDeleted: false,
  })

  if (academicProduct) {
    academicProduct.isDeleted = true
    academicProduct.deletedAt = new Date()
    await academicProduct.save()
  }

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'delete',
    resource: 'uploaded_file',
    resourceId: uploadedFile._id,
    details: `Eliminacion del archivo ${uploadedFile.originalFilename}`,
  })

  if (academicProduct) {
    await logAudit(event, {
      userId: auth.sub,
      userName: auth.email,
      action: 'delete',
      resource: 'academic_product',
      resourceId: academicProduct._id,
      details: `Eliminacion derivada del producto por archivo ${uploadedFile.originalFilename}`,
    })
  }

  return ok({ message: 'Archivo eliminado correctamente' })
})
