import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'

/**
 * Si otro envío ya completado comparte el mismo digest y aún tiene al menos un producto activo,
 * el nuevo envío no debe incorporarse al repositorio.
 */
export async function findBlockingCompletedUploadForContentDigest(
  digestValue: string,
  excludeUploadIdHex: string,
): Promise<{ blockingUploadId: string } | null> {
  const other = await UploadedFile.findOne({
    _id: { $ne: excludeUploadIdHex },
    isDeleted: false,
    processingStatus: 'completed',
    'contentDigest.value': digestValue,
  })
    .select('_id')
    .lean()

  if (!other?._id) {
    return null
  }

  const hasActiveProduct = await AcademicProduct.exists({
    sourceFile: other._id,
    isDeleted: false,
  })

  return hasActiveProduct ? { blockingUploadId: String(other._id) } : null
}
