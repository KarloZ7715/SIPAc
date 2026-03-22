import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import cleanupDraftsEndpoint from '../../server/api/system/cleanup-drafts'

const {
  mockAcademicProductFind,
  mockAcademicProductFindByIdAndDelete,
  mockAcademicProductFindOne,
  mockAcademicProductCountDocuments,
  mockAcademicProductExists,
  mockAcademicProductDeleteMany,
  mockUploadedFileFind,
  mockUploadedFileFindById,
  mockUploadedFileFindByIdAndDelete,
  mockDeleteFileFromGridFs,
} = vi.hoisted(() => ({
  mockAcademicProductFind: vi.fn(),
  mockAcademicProductFindByIdAndDelete: vi.fn(),
  mockAcademicProductFindOne: vi.fn(),
  mockAcademicProductCountDocuments: vi.fn(),
  mockAcademicProductExists: vi.fn(),
  mockAcademicProductDeleteMany: vi.fn(),
  mockUploadedFileFind: vi.fn(),
  mockUploadedFileFindById: vi.fn(),
  mockUploadedFileFindByIdAndDelete: vi.fn(),
  mockDeleteFileFromGridFs: vi.fn(),
}))

vi.mock('../../server/models/AcademicProduct', () => ({
  default: {
    find: mockAcademicProductFind,
    findByIdAndDelete: mockAcademicProductFindByIdAndDelete,
    findOne: mockAcademicProductFindOne,
    countDocuments: mockAcademicProductCountDocuments,
    exists: mockAcademicProductExists,
    deleteMany: mockAcademicProductDeleteMany,
  },
}))

vi.mock('../../server/models/UploadedFile', () => ({
  default: {
    find: mockUploadedFileFind,
    findById: mockUploadedFileFindById,
    findByIdAndDelete: mockUploadedFileFindByIdAndDelete,
  },
}))

vi.mock('../../server/services/storage/gridfs', () => ({
  deleteFileFromGridFs: mockDeleteFileFromGridFs,
}))

describe('System Cleanup Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAcademicProductCountDocuments.mockResolvedValue(0)
    mockAcademicProductExists.mockResolvedValue(null)
    mockAcademicProductDeleteMany.mockResolvedValue({ deletedCount: 0 })
    vi.useFakeTimers()
    const now = new Date('2026-03-16T12:00:00.000Z')
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('deletes soft-deleted drafts older than 30 days and their associated files', async () => {
    const expiredDraftId = 'draft123'
    const uploadedFileId = 'file123'
    const gridfsId = 'grid123'

    mockAcademicProductFind.mockResolvedValueOnce([
      { _id: expiredDraftId, sourceFile: uploadedFileId },
    ])
    mockUploadedFileFindById.mockResolvedValueOnce({
      _id: uploadedFileId,
      gridfsFileId: gridfsId,
    })
    mockUploadedFileFind.mockResolvedValueOnce([]) // No orphan files in pass 2

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await cleanupDraftsEndpoint({} as any)

    expect(mockAcademicProductFind).toHaveBeenCalledTimes(1)
    expect(mockUploadedFileFindById).toHaveBeenCalledWith(uploadedFileId)
    expect(mockAcademicProductFindByIdAndDelete).toHaveBeenCalledWith(expiredDraftId)
    expect(mockDeleteFileFromGridFs).toHaveBeenCalledWith(gridfsId)
    expect(mockUploadedFileFindByIdAndDelete).toHaveBeenCalledWith(uploadedFileId)

    expect(result.deletedProductsCount).toBe(1)
    expect(result.deletedFilesCount).toBe(1)
  })

  it('does NOT delete soft-deleted confirmed products attached to files', async () => {
    const uploadedFileId = 'file123'
    const gridfsId = 'grid123'

    // Pass 1: No expired drafts found
    mockAcademicProductFind.mockResolvedValueOnce([])

    // Pass 2: An expired file is found (maybe it was soft-deleted but belongs to a confirmed product)
    mockUploadedFileFind.mockResolvedValueOnce([{ _id: uploadedFileId, gridfsFileId: gridfsId }])

    // Hay al menos un producto confirmado ligado al archivo
    mockAcademicProductExists.mockResolvedValueOnce({ _id: 'confirmed123' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await cleanupDraftsEndpoint({} as any)

    // Should skip deletion
    expect(mockDeleteFileFromGridFs).not.toHaveBeenCalled()
    expect(mockUploadedFileFindByIdAndDelete).not.toHaveBeenCalled()
    expect(mockAcademicProductDeleteMany).not.toHaveBeenCalled()

    expect(result.deletedProductsCount).toBe(0)
    expect(result.deletedFilesCount).toBe(0)
  })

  it('deletes orphan files seamlessly', async () => {
    const uploadedFileId = 'orphan123'
    const gridfsId = 'grid123'

    mockAcademicProductFind.mockResolvedValueOnce([]) // No drafts

    // Pass 2: Orphan file found
    mockUploadedFileFind.mockResolvedValueOnce([{ _id: uploadedFileId, gridfsFileId: gridfsId }])

    mockAcademicProductExists.mockResolvedValueOnce(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await cleanupDraftsEndpoint({} as any)

    expect(mockDeleteFileFromGridFs).toHaveBeenCalledWith(gridfsId)
    expect(mockUploadedFileFindByIdAndDelete).toHaveBeenCalledWith(uploadedFileId)
    expect(mockAcademicProductDeleteMany).toHaveBeenCalled()

    expect(result.deletedProductsCount).toBe(0)
    expect(result.deletedFilesCount).toBe(1)
  })
})
