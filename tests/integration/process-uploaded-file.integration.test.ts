import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processUploadedFile } from '~~/server/services/upload/process-uploaded-file'

const {
  mockUploadedFileFindById,
  mockAcademicProductFindOne,
  mockAcademicProductFindByIdAndUpdate,
  mockAcademicProductCreate,
  mockUserFindById,
  mockReadGridFsFileToBuffer,
  mockExtractDocumentText,
  mockExtractAcademicEntities,
  mockNotifyDocumentProcessing,
  mockLogSystemAudit,
  mockLogPipelineEvent,
  mockClassifyPipelineError,
} = vi.hoisted(() => ({
  mockUploadedFileFindById: vi.fn(),
  mockAcademicProductFindOne: vi.fn(),
  mockAcademicProductFindByIdAndUpdate: vi.fn(),
  mockAcademicProductCreate: vi.fn(),
  mockUserFindById: vi.fn(),
  mockReadGridFsFileToBuffer: vi.fn(),
  mockExtractDocumentText: vi.fn(),
  mockExtractAcademicEntities: vi.fn(),
  mockNotifyDocumentProcessing: vi.fn(),
  mockLogSystemAudit: vi.fn(),
  mockLogPipelineEvent: vi.fn(),
  mockClassifyPipelineError: vi.fn(),
}))

vi.mock('~~/server/models/UploadedFile', () => ({
  default: {
    findById: mockUploadedFileFindById,
  },
}))

vi.mock('~~/server/models/AcademicProduct', () => ({
  default: {
    findOne: mockAcademicProductFindOne,
    findByIdAndUpdate: mockAcademicProductFindByIdAndUpdate,
    create: mockAcademicProductCreate,
  },
}))

vi.mock('~~/server/models/User', () => ({
  default: {
    findById: mockUserFindById,
  },
}))

vi.mock('~~/server/services/storage/gridfs', () => ({
  readGridFsFileToBuffer: mockReadGridFsFileToBuffer,
}))

vi.mock('~~/server/services/ocr/extract-document-text', () => ({
  extractDocumentText: mockExtractDocumentText,
}))

vi.mock('~~/server/services/ner/extract-academic-entities', () => ({
  extractAcademicEntities: mockExtractAcademicEntities,
}))

vi.mock('~~/server/services/notifications/notify-document-processing', () => ({
  notifyDocumentProcessing: mockNotifyDocumentProcessing,
}))

vi.mock('~~/server/utils/audit', () => ({
  logSystemAudit: mockLogSystemAudit,
}))

vi.mock('~~/server/utils/pipeline-observability', () => ({
  logPipelineEvent: mockLogPipelineEvent,
  classifyPipelineError: mockClassifyPipelineError,
}))

type UploadedFileDoc = {
  _id: { toString: () => string }
  uploadedBy: { toString: () => string }
  gridfsFileId: string
  originalFilename: string
  mimeType: 'application/pdf'
  isDeleted: boolean
  processingStatus: 'pending' | 'processing' | 'completed' | 'error'
  processingAttempt?: number
  processingError?: string
  ocrProvider?: 'pdfjs_native' | 'gemini_vision'
  ocrModel?: string
  ocrConfidence?: number
  nerProvider?: 'cerebras' | 'gemini'
  nerModel?: string
  productType?: string
  rawExtractedText?: string
  documentClassification?: 'academic' | 'non_academic' | 'uncertain'
  classificationConfidence?: number
  classificationRationale?: string
  processingStartedAt?: Date
  ocrCompletedAt?: Date
  nerStartedAt?: Date
  processingCompletedAt?: Date
  save: ReturnType<typeof vi.fn>
}

function createUploadedFileDoc(overrides: Partial<UploadedFileDoc> = {}): UploadedFileDoc {
  return {
    _id: { toString: () => 'upload-1' },
    uploadedBy: { toString: () => 'user-1' },
    gridfsFileId: 'gridfs-1',
    originalFilename: 'documento.pdf',
    mimeType: 'application/pdf',
    isDeleted: false,
    processingStatus: 'pending',
    processingAttempt: 0,
    save: vi.fn(async () => undefined),
    ...overrides,
  }
}

function createOwnerQueryResult() {
  return {
    select: vi.fn(() => ({
      lean: vi.fn(async () => ({
        fullName: 'Docente Demo',
        email: 'docente@demo.edu',
      })),
    })),
  }
}

describe('processUploadedFile integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUserFindById.mockReturnValue(createOwnerQueryResult())
    mockReadGridFsFileToBuffer.mockResolvedValue(Buffer.from('pdf-buffer'))
    mockClassifyPipelineError.mockReturnValue({
      errorType: 'runtime_error',
      errorMessage: 'runtime error',
    })
  })

  it('completes full pipeline for academic PDF and creates product draft', async () => {
    const uploadedFile = createUploadedFileDoc()
    mockUploadedFileFindById.mockResolvedValue(uploadedFile)

    mockExtractDocumentText.mockResolvedValue({
      text: 'texto nativo academico',
      provider: 'pdfjs_native',
      modelId: undefined,
      confidence: 0.91,
      blocks: [],
    })

    mockExtractAcademicEntities.mockResolvedValue({
      productType: 'article',
      documentClassification: 'academic',
      classificationConfidence: 0.92,
      classificationRationale: 'Documento academico',
      authors: [{ value: 'Ada Lovelace', confidence: 0.9, anchors: [] }],
      title: { value: 'Articulo de Prueba', confidence: 0.93, anchors: [] },
      institution: { value: 'Universidad Demo', confidence: 0.88, anchors: [] },
      date: { value: new Date('2026-03-13T00:00:00.000Z'), confidence: 0.85, anchors: [] },
      keywords: [{ value: 'ia', confidence: 0.89, anchors: [] }],
      doi: { value: '10.1000/demo', confidence: 0.87, anchors: [] },
      eventOrJournal: { value: 'Revista Demo', confidence: 0.86, anchors: [] },
      extractionSource: 'pdfjs_native',
      extractionConfidence: 0.9,
      nerProvider: 'cerebras',
      nerModel: 'gpt-oss-120b',
      extractedAt: new Date('2026-03-13T01:00:00.000Z'),
    })

    mockAcademicProductFindOne.mockResolvedValue(null)
    mockAcademicProductCreate.mockResolvedValue({
      _id: { toString: () => 'product-1' },
    })

    await processUploadedFile('upload-1')

    expect(uploadedFile.processingStatus).toBe('completed')
    expect(uploadedFile.ocrProvider).toBe('pdfjs_native')
    expect(uploadedFile.nerProvider).toBe('cerebras')
    expect(mockAcademicProductCreate).toHaveBeenCalledTimes(1)
    expect(mockNotifyDocumentProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        uploadedFileId: 'upload-1',
      }),
    )

    expect(mockLogPipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'processing',
        event: 'start',
        traceId: 'upload:upload-1:attempt:1',
      }),
    )

    expect(mockLogPipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'processing',
        event: 'completed',
        traceId: 'upload:upload-1:attempt:1',
      }),
    )
  })

  it('marks upload as error when document policy blocks non academic document', async () => {
    const uploadedFile = createUploadedFileDoc()
    mockUploadedFileFindById.mockResolvedValue(uploadedFile)

    mockExtractDocumentText.mockResolvedValue({
      text: 'texto del documento',
      provider: 'pdfjs_native',
      confidence: 0.88,
      blocks: [],
    })

    mockExtractAcademicEntities.mockResolvedValue({
      productType: 'article',
      documentClassification: 'non_academic',
      classificationConfidence: 0.83,
      classificationRationale: 'No academico',
      authors: [],
      title: undefined,
      institution: undefined,
      date: undefined,
      keywords: [],
      doi: undefined,
      eventOrJournal: undefined,
      extractionSource: 'pdfjs_native',
      extractionConfidence: 0.4,
      nerProvider: 'gemini',
      nerModel: 'gemini-2.5-flash',
      extractedAt: new Date('2026-03-13T01:00:00.000Z'),
    })

    await processUploadedFile('upload-1')

    expect(uploadedFile.processingStatus).toBe('error')
    expect(uploadedFile.processingError).toContain('no parece corresponder')
    expect(mockAcademicProductCreate).not.toHaveBeenCalled()
    expect(mockNotifyDocumentProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        uploadedFileId: 'upload-1',
      }),
    )

    expect(mockLogPipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'processing',
        event: 'start',
        traceId: 'upload:upload-1:attempt:1',
      }),
    )
  })

  it('persists error path when OCR throws and notifies failure', async () => {
    const uploadedFile = createUploadedFileDoc()
    mockUploadedFileFindById.mockResolvedValueOnce(uploadedFile).mockResolvedValueOnce(uploadedFile)

    mockExtractDocumentText.mockRejectedValue(new Error('ocr exploded'))
    mockClassifyPipelineError.mockReturnValue({
      errorType: 'runtime_error',
      errorMessage: 'ocr exploded',
    })

    await processUploadedFile('upload-1')

    expect(uploadedFile.processingStatus).toBe('error')
    expect(uploadedFile.processingError).toContain('ocr exploded')
    expect(mockNotifyDocumentProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        errorMessage: expect.stringContaining('ocr exploded'),
      }),
    )

    expect(mockLogPipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'processing',
        event: 'failed',
        errorType: 'runtime_error',
        traceId: 'upload:upload-1:attempt:1',
      }),
    )
  })
})
