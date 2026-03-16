import { defineEventHandler } from 'h3'
import AcademicProductModel from '~~/server/models/AcademicProduct'
import UploadedFileModel from '~~/server/models/UploadedFile'
import { deleteFileFromGridFs } from '~~/server/services/storage/gridfs'

export default defineEventHandler(async (_event) => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  let deletedProductsCount = 0
  let deletedFilesCount = 0
  const errors: string[] = []

  const expiredDrafts = await AcademicProductModel.find({
    isDeleted: true,
    reviewStatus: 'draft',
    deletedAt: { $lt: thirtyDaysAgo },
  })

  for (const draft of expiredDrafts) {
    try {
      const sourceFile = await UploadedFileModel.findById(draft.sourceFile)

      await AcademicProductModel.findByIdAndDelete(draft._id)
      deletedProductsCount++

      if (sourceFile) {
        if (sourceFile.gridfsFileId) {
          try {
            await deleteFileFromGridFs(sourceFile.gridfsFileId)
          } catch (gridfsError) {
            console.error(`Failed to delete GridFS file ${sourceFile.gridfsFileId}:`, gridfsError)
          }
        }
        await UploadedFileModel.findByIdAndDelete(sourceFile._id)
        deletedFilesCount++
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      errors.push(`Failed cleaning up product ${draft._id}: ${err.message}`)
    }
  }

  const expiredFiles = await UploadedFileModel.find({
    isDeleted: true,
    deletedAt: { $lt: thirtyDaysAgo },
  })

  for (const file of expiredFiles) {
    try {
      const attachedProduct = await AcademicProductModel.findOne({ sourceFile: file._id })

      if (attachedProduct && attachedProduct.reviewStatus === 'confirmed') {
        continue
      }

      if (attachedProduct && attachedProduct.reviewStatus === 'draft') {
        if (!attachedProduct.isDeleted) {
          continue
        }
      }

      if (file.gridfsFileId) {
        try {
          await deleteFileFromGridFs(file.gridfsFileId)
        } catch (gridfsError) {
          console.error(`Failed to delete GridFS file ${file.gridfsFileId}:`, gridfsError)
        }
      }

      await UploadedFileModel.findByIdAndDelete(file._id)
      deletedFilesCount++

      if (attachedProduct && attachedProduct.reviewStatus === 'draft') {
        await AcademicProductModel.findByIdAndDelete(attachedProduct._id)
        deletedProductsCount++
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      errors.push(`Failed cleaning up file ${file._id}: ${err.message}`)
    }
  }

  return {
    success: true,
    message: 'Cleanup completed',
    deletedProductsCount,
    deletedFilesCount,
    errors: errors.length > 0 ? errors : undefined,
  }
})
