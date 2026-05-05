import { beforeEach, describe, expect, it, vi } from 'vitest'

const fileTypeFromBufferMock = vi.fn()

vi.mock('file-type', () => ({
  fileTypeFromBuffer: fileTypeFromBufferMock,
}))

const { detectAllowedMimeType } = await import('~~/server/utils/upload')

describe('detectAllowedMimeType', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns detected MIME when it is already allowed', async () => {
    fileTypeFromBufferMock.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' })

    await expect(detectAllowedMimeType(Buffer.from([0x25, 0x50, 0x44, 0x46]))).resolves.toBe(
      'application/pdf',
    )
  })

  it('falls back to legacy DOC MIME when detector reports generic CFB', async () => {
    fileTypeFromBufferMock.mockResolvedValue({ mime: 'application/x-cfb', ext: 'cfb' })

    await expect(
      detectAllowedMimeType(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), { filename: 'archivo.doc' }),
    ).resolves.toBe('application/msword')
  })

  it('falls back to declared legacy MIME when filename has no Office extension', async () => {
    fileTypeFromBufferMock.mockResolvedValue({ mime: 'application/x-cfb', ext: 'cfb' })

    await expect(
      detectAllowedMimeType(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), {
        filename: 'archivo.bin',
        declaredMimeType: 'application/vnd.ms-excel',
      }),
    ).resolves.toBe('application/vnd.ms-excel')
  })

  it('rejects CFB payload without filename or declared MIME hints', async () => {
    fileTypeFromBufferMock.mockResolvedValue({ mime: 'application/x-cfb', ext: 'cfb' })

    await expect(
      detectAllowedMimeType(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])),
    ).rejects.toMatchObject({
      statusCode: 400,
    })
  })
})
