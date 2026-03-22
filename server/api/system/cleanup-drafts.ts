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
      const sourceFileId = draft.sourceFile

      await AcademicProductModel.findByIdAndDelete(draft._id)
      deletedProductsCount++

      const remainingProducts = await AcademicProductModel.countDocuments({
        sourceFile: sourceFileId,
      })
      if (remainingProducts > 0) {
        continue
      }

      const sourceFile = await UploadedFileModel.findById(sourceFileId)

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
      const hasConfirmed = await AcademicProductModel.exists({
        sourceFile: file._id,
        reviewStatus: 'confirmed',
        isDeleted: false,
      })

      if (hasConfirmed) {
        continue
      }

      if (file.gridfsFileId) {
        try {
          await deleteFileFromGridFs(file.gridfsFileId)
        } catch (gridfsError) {
          console.error(`Failed to delete GridFS file ${file.gridfsFileId}:`, gridfsError)
        }
      }

      const deleteResult = await AcademicProductModel.deleteMany({ sourceFile: file._id })
      deletedProductsCount += deleteResult.deletedCount ?? 0

      await UploadedFileModel.findByIdAndDelete(file._id)
      deletedFilesCount++
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
