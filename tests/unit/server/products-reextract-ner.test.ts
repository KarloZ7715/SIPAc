import { beforeEach, describe, expect, it, vi } from 'vitest'

const findOneProduct = vi.fn()
const findOneUpload = vi.fn()
const findByIdAndUpdate = vi.fn()
const readGridFsMock = vi.fn()
const extractDocumentTextMock = vi.fn()
const classifyDocumentForNerMock = vi.fn()
const extractAcademicEntitiesMock = vi.fn()
const extractProductSpecificMetadataMock = vi.fn()

vi.mock('~~/server/models/AcademicProduct', () => ({
  default: {
    findOne: (...args: unknown[]) => findOneProduct(...args),
    findByIdAndUpdate: (...args: unknown[]) => findByIdAndUpdate(...args),
  },
}))

vi.mock('~~/server/models/UploadedFile', () => ({
  default: {
    findOne: (...args: unknown[]) => findOneUpload(...args),
  },
}))

vi.mock('~~/server/services/storage/gridfs', () => ({
  readGridFsFileToBuffer: readGridFsMock,
}))

vi.mock('~~/server/services/ocr/extract-document-text', () => ({
  extractDocumentText: extractDocumentTextMock,
}))

vi.mock('~~/server/services/ner/extract-academic-entities', () => ({
  classifyDocumentForNer: classifyDocumentForNerMock,
  extractAcademicEntities: extractAcademicEntitiesMock,
  extractProductSpecificMetadata: extractProductSpecificMetadataMock,
}))

vi.mock('~~/server/services/ner/product-specific-validation', () => ({
  validateProductSpecificMetadata: vi.fn(() => ({
    sanitized: {},
    droppedFields: [] as string[],
    corrections: [] as string[],
  })),
}))

vi.mock('~~/server/services/upload/process-uploaded-file', () => ({
  buildProductSpecificFields: vi.fn(() => ({})),
}))

vi.mock('~~/server/utils/workspace-classification-gate', () => ({
  getWorkspaceClassificationRejectionMessage: vi.fn(() => null),
}))

vi.mock('~~/server/utils/pipeline-observability', () => ({
  classifyPipelineError: vi.fn(() => ({ errorType: 'unknown', errorMessage: 'test' })),
  logPipelineEvent: vi.fn(),
}))

describe('reextractProductNer', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    classifyDocumentForNerMock.mockResolvedValue({})
    extractProductSpecificMetadataMock.mockResolvedValue({})
    extractAcademicEntitiesMock.mockResolvedValue({
      productType: 'thesis',
      extractionConfidence: 0.82,
      authors: [],
      title: { value: 'Tesis', confidence: 0.9 },
      institution: { value: 'Uni', confidence: 0.8 },
      date: { value: new Date('2020-01-01'), confidence: 0.7 },
      keywords: [],
      doi: { value: '', confidence: 0 },
      eventOrJournal: { value: '', confidence: 0 },
      extractionSource: 'pdfjs_native',
      nerProvider: 'gemini',
      nerModel: 'gemini-2.0-flash',
      nerAttemptTrace: [],
    })
  })

  it('lanza 404 si el producto no existe', async () => {
    findOneProduct.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })

    const { reextractProductNer } =
      await import('~~/server/services/products/reextract-product-ner')

    await expect(
      reextractProductNer({
        productId: '507f191e810c19729de860ea',
        userId: '507f191e810c19729de860ea',
      }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('lanza 403 si el usuario no es el propietario', async () => {
    findOneProduct.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: '507f191e810c19729de860ea',
        owner: '507f191e810c19729de860eb',
        sourceFile: '507f191e810c19729de860ec',
        productType: 'thesis',
        segmentIndex: 0,
        segmentBounds: null,
        isDeleted: false,
      }),
    })

    const { reextractProductNer } =
      await import('~~/server/services/products/reextract-product-ner')

    await expect(
      reextractProductNer({
        productId: '507f191e810c19729de860ea',
        userId: '507f191e810c19729de860ea',
      }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('re-extrae y devuelve la nueva confianza', async () => {
    findOneProduct.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: '507f191e810c19729de860ea',
        owner: '507f191e810c19729de860ea',
        sourceFile: '507f191e810c19729de860ec',
        productType: 'thesis',
        segmentIndex: 0,
        segmentBounds: { textStart: 0, textEnd: 4 },
        isDeleted: false,
      }),
    })

    findOneUpload.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: '507f191e810c19729de860ec',
        isDeleted: false,
        rawExtractedText: 'abcd',
        ocrProvider: 'pdfjs_native',
        mimeType: 'application/pdf',
        gridfsFileId: 'gf1',
        sourceWorkCount: 1,
      }),
    })

    findByIdAndUpdate.mockResolvedValue({
      extractedEntities: { extractionConfidence: 0.82 },
    })

    const { reextractProductNer } =
      await import('~~/server/services/products/reextract-product-ner')

    const result = await reextractProductNer({
      productId: '507f191e810c19729de860ea',
      userId: '507f191e810c19729de860ea',
    })

    expect(result.extractionConfidence).toBe(0.82)
    expect(readGridFsMock).not.toHaveBeenCalled()
    expect(extractDocumentTextMock).not.toHaveBeenCalled()
    expect(extractAcademicEntitiesMock).toHaveBeenCalled()
    expect(findByIdAndUpdate).toHaveBeenCalled()
  })
})
