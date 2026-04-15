import mongoose from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUploadedFileFindOne = vi.fn()
const mockAcademicProductExists = vi.fn()

vi.mock('~~/server/models/UploadedFile', () => ({
  default: {
    findOne: mockUploadedFileFindOne,
  },
}))

vi.mock('~~/server/models/AcademicProduct', () => ({
  default: {
    exists: mockAcademicProductExists,
  },
}))

const { findBlockingCompletedUploadForContentDigest } =
  await import('~~/server/services/upload/find-blocking-duplicate-upload')

describe('findBlockingCompletedUploadForContentDigest', () => {
  const excludeId = new mongoose.Types.ObjectId()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no other completed upload shares the digest', async () => {
    mockUploadedFileFindOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    })

    const result = await findBlockingCompletedUploadForContentDigest(
      'a'.repeat(64),
      excludeId.toString(),
    )

    expect(result).toBeNull()
    expect(mockAcademicProductExists).not.toHaveBeenCalled()
  })

  it('returns null when other upload exists but has no active products', async () => {
    const otherId = new mongoose.Types.ObjectId()
    mockUploadedFileFindOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: otherId }),
      }),
    })
    mockAcademicProductExists.mockResolvedValue(null)

    const digest = 'b'.repeat(64)
    const result = await findBlockingCompletedUploadForContentDigest(digest, excludeId.toString())

    expect(result).toBeNull()
    expect(mockUploadedFileFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $ne: excludeId.toString() },
        isDeleted: false,
        processingStatus: 'completed',
        'contentDigest.value': digest,
      }),
    )
    expect(mockAcademicProductExists).toHaveBeenCalledWith({
      sourceFile: otherId,
      isDeleted: false,
    })
  })

  it('returns blocking upload id when an active product exists', async () => {
    const otherId = new mongoose.Types.ObjectId()
    mockUploadedFileFindOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: otherId }),
      }),
    })
    mockAcademicProductExists.mockResolvedValue({ _id: new mongoose.Types.ObjectId() })

    const result = await findBlockingCompletedUploadForContentDigest(
      'c'.repeat(64),
      excludeId.toString(),
    )

    expect(result).toEqual({ blockingUploadId: String(otherId) })
  })
})
