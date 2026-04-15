import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UPLOAD_ERROR_DUPLICATE_IN_REPOSITORY } from '~~/app/types'
import { processUploadedFile } from '~~/server/services/upload/process-uploaded-file'

const integrationEnvFixture = {
  mongodbUri: 'mongodb://localhost:27017/sipac',
  jwtSecret: 'abcdefghijklmnopqrstuvwxyz123456',
  googleApiKey: 'test-google-key',
  googleGeminiIncludeProModels: false,
  groqApiKey: '',
  nvidiaApiKey: '',
  nvidiaApiBaseUrl: 'https://integrate.api.nvidia.com/v1',
  openrouterApiKey: '',
  openrouterAppUrl: '',
  cerebrasApiKey: '',
  mistralApiKey: '',
  ocrProvider: 'gemini' as const,
  llmProvider: 'cerebras' as const,
  ocrRequestTimeoutMs: 45_000,
  ocrMaxGeminiVisionAttempts: 6,
  nerRequestTimeoutMs: 35_000,
  nerMaxCandidateAttempts: 4,
  nerConfidenceThreshold: 0.7,
  nerAlwaysSecondPass: false,
  nerMergeExtractionPasses: true,
  nerProductSpecificFillPass: true,
  nerProductSpecificSparseThreshold: 0.4,
  nerSegmentationEnabled: false,
  nerSegmentationMaxSegments: 6,
  nerSegmentationInputMaxChars: 28_000,
  nerSegmentationMinSegmentChars: 400,
  nerSegmentationModelId: 'gemini-2.5-flash-lite',
  rateLimitDocumentsPerHour: 15,
  resendApiKey: '',
  resendFromEmail: '',
}

vi.mock('~~/server/utils/env', () => ({
  validateEnv: vi.fn(() => integrationEnvFixture),
}))

const {
  mockUploadedFileFindById,
  mockUploadedFileFindOne,
  mockUploadedFileFindOneAndUpdate,
  mockAcademicProductFindOne,
  mockAcademicProductFindByIdAndUpdate,
  mockAcademicProductCreate,
  mockAcademicProductExists,
  mockAcademicProductUpdateMany,
  mockUserFindById,
  mockReadGridFsFileToBuffer,
  mockExtractDocumentText,
  mockExtractAcademicEntities,
  mockExtractProductSpecificMetadata,
  mockClassifyDocumentForNer,
  mockResolveTextSegments,
  mockNotifyDocumentProcessing,
  mockLogSystemAudit,
  mockLogPipelineEvent,
  mockClassifyPipelineError,
} = vi.hoisted(() => ({
  mockUploadedFileFindById: vi.fn(),
  mockUploadedFileFindOne: vi.fn(),
  mockUploadedFileFindOneAndUpdate: vi.fn(),
  mockAcademicProductFindOne: vi.fn(),
  mockAcademicProductFindByIdAndUpdate: vi.fn(),
  mockAcademicProductCreate: vi.fn(),
  mockAcademicProductExists: vi.fn(),
  mockAcademicProductUpdateMany: vi.fn(),
  mockUserFindById: vi.fn(),
  mockReadGridFsFileToBuffer: vi.fn(),
  mockExtractDocumentText: vi.fn(),
  mockExtractAcademicEntities: vi.fn(),
  mockExtractProductSpecificMetadata: vi.fn(),
  mockClassifyDocumentForNer: vi.fn(),
  mockResolveTextSegments: vi.fn(),
  mockNotifyDocumentProcessing: vi.fn(),
  mockLogSystemAudit: vi.fn(),
  mockLogPipelineEvent: vi.fn(),
  mockClassifyPipelineError: vi.fn(),
}))

vi.mock('~~/server/models/UploadedFile', () => ({
  default: {
    findById: mockUploadedFileFindById,
    findOne: mockUploadedFileFindOne,
    findOneAndUpdate: mockUploadedFileFindOneAndUpdate,
  },
}))

vi.mock('~~/server/models/AcademicProduct', () => ({
  default: {
    findOne: mockAcademicProductFindOne,
    findByIdAndUpdate: mockAcademicProductFindByIdAndUpdate,
    create: mockAcademicProductCreate,
    exists: mockAcademicProductExists,
    updateMany: mockAcademicProductUpdateMany,
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
  extractProductSpecificMetadata: mockExtractProductSpecificMetadata,
  classifyDocumentForNer: mockClassifyDocumentForNer,
}))

vi.mock('~~/server/services/ner/document-segmentation', () => ({
  resolveTextSegments: mockResolveTextSegments,
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

/** Mongoose `findOne().select().lean()` chain used por `findBlockingCompletedUploadForContentDigest`. */
function createUploadedFileFindOneDuplicateChain(leanResult: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(leanResult),
    }),
  }
}

function applyMongoLikeUpdate(target: Record<string, unknown>, update: Record<string, unknown>) {
  const setPayload = (update.$set ?? {}) as Record<string, unknown>
  const incPayload = (update.$inc ?? {}) as Record<string, unknown>

  Object.entries(setPayload).forEach(([key, value]) => {
    target[key] = value
  })

  Object.entries(incPayload).forEach(([key, value]) => {
    const increment = typeof value === 'number' ? value : 0
    const current = typeof target[key] === 'number' ? (target[key] as number) : 0
    target[key] = current + increment
  })
}

function mockAtomicUploadedFileUpdates(uploadedFile: UploadedFileDoc) {
  mockUploadedFileFindOneAndUpdate.mockImplementation(
    async (_filter: unknown, update: Record<string, unknown>) => {
      applyMongoLikeUpdate(uploadedFile as unknown as Record<string, unknown>, update)
      return uploadedFile
    },
  )
}

describe('processUploadedFile integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUploadedFileFindOne.mockImplementation(() => createUploadedFileFindOneDuplicateChain(null))
    mockAcademicProductExists.mockResolvedValue(null)
    mockUserFindById.mockReturnValue(createOwnerQueryResult())
    mockReadGridFsFileToBuffer.mockResolvedValue(Buffer.from('pdf-buffer'))
    mockClassifyPipelineError.mockReturnValue({
      errorType: 'runtime_error',
      errorMessage: 'runtime error',
    })
    mockExtractProductSpecificMetadata.mockResolvedValue({})
    mockUploadedFileFindOneAndUpdate.mockReset()
    mockAcademicProductUpdateMany.mockResolvedValue({ modifiedCount: 0, deletedCount: 0 })
    mockResolveTextSegments.mockImplementation(async ({ fullText }: { fullText: string }) => ({
      segments: [{ textStart: 0, textEnd: fullText.length }],
      usedLlm: false,
      heuristicMultiple: false,
    }))
    mockClassifyDocumentForNer.mockImplementation(async () => ({
      productType: 'article' as const,
      documentClassification: 'academic' as const,
      classificationConfidence: 0.92,
      classificationRationale: 'Documento academico',
      classificationSource: 'llm' as const,
    }))
  })

  it('completes full pipeline for academic PDF and creates product draft', async () => {
    const uploadedFile = createUploadedFileDoc()
    mockUploadedFileFindById.mockResolvedValue(uploadedFile)
    mockAtomicUploadedFileUpdates(uploadedFile)

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
      classificationSource: 'llm',
      authors: [{ value: 'Ada Lovelace', confidence: 0.9, anchors: [] }],
      title: { value: 'Articulo de Prueba', confidence: 0.93, anchors: [] },
      institution: { value: 'Universidad Demo', confidence: 0.88, anchors: [] },
      date: { value: new Date('2026-03-13T00:00:00.000Z'), confidence: 0.85, anchors: [] },
      keywords: [{ value: 'ia', confidence: 0.89, anchors: [] }],
      doi: { value: '10.1000/demo', confidence: 0.87, anchors: [] },
      eventOrJournal: { value: 'Revista Demo', confidence: 0.86, anchors: [] },
      extractionSource: 'pdfjs_native',
      extractionConfidence: 0.9,
      evidenceCoverage: 0.55,
      nerProvider: 'cerebras',
      nerModel: 'gpt-oss-120b',
      nerAttemptTrace: [],
      extractedAt: new Date('2026-03-13T01:00:00.000Z'),
    })

    mockExtractProductSpecificMetadata.mockResolvedValue({
      journalName: 'Revista Internacional Demo',
      volume: '12',
      issue: '3',
      pages: '10-24',
      issn: '1234-5678',
      indexing: ['Scopus', 'SciELO'],
      openAccess: true,
      articleType: 'original',
      language: 'es',
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
    expect(mockAcademicProductCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentIndex: 0,
        journalName: 'Revista Internacional Demo',
        volume: '12',
        issue: '3',
        pages: '10-24',
        openAccess: true,
      }),
    )
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

  it('rechaza procesamiento cuando la clasificación es no académica con confianza suficiente', async () => {
    const uploadedFile = createUploadedFileDoc()
    mockUploadedFileFindById.mockResolvedValue(uploadedFile)
    mockAtomicUploadedFileUpdates(uploadedFile)

    mockExtractDocumentText.mockResolvedValue({
      text: 'texto del documento',
      provider: 'pdfjs_native',
      confidence: 0.88,
      blocks: [],
    })

    mockClassifyDocumentForNer.mockResolvedValue({
      productType: 'article',
      documentClassification: 'non_academic',
      classificationConfidence: 0.83,
      classificationRationale: 'No academico',
      classificationSource: 'llm',
    })

    await processUploadedFile('upload-1')

    expect(mockExtractAcademicEntities).not.toHaveBeenCalled()
    expect(mockAcademicProductCreate).not.toHaveBeenCalled()
    expect(mockNotifyDocumentProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        uploadedFileId: 'upload-1',
        errorMessage: expect.stringContaining('no encaja'),
      }),
    )

    expect(mockLogPipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'processing',
        event: 'rejected_document_classification',
      }),
    )
  })

  it('persists error path when OCR throws and notifies failure', async () => {
    const uploadedFile = createUploadedFileDoc()
    mockUploadedFileFindById.mockResolvedValueOnce(uploadedFile).mockResolvedValueOnce(uploadedFile)
    mockAtomicUploadedFileUpdates(uploadedFile)

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

  it('retries OCR once when quality gate flags poor extraction', async () => {
    const uploadedFile = createUploadedFileDoc()
    mockUploadedFileFindById.mockResolvedValue(uploadedFile)
    mockAtomicUploadedFileUpdates(uploadedFile)

    mockExtractDocumentText
      .mockResolvedValueOnce({
        text: '###',
        provider: 'pdfjs_native',
        confidence: 0.18,
        blocks: [],
      })
      .mockResolvedValueOnce({
        text: 'Texto academico corregido con suficiente longitud para procesar metadatos',
        provider: 'pdfjs_native',
        confidence: 0.89,
        blocks: [],
      })

    mockExtractAcademicEntities.mockResolvedValue({
      productType: 'article',
      documentClassification: 'academic',
      classificationConfidence: 0.91,
      classificationRationale: 'Documento academico',
      classificationSource: 'llm',
      authors: [{ value: 'Ada Lovelace', confidence: 0.9, anchors: [] }],
      title: { value: 'Articulo de Prueba', confidence: 0.93, anchors: [] },
      institution: { value: 'Universidad Demo', confidence: 0.88, anchors: [] },
      date: { value: new Date('2026-03-13T00:00:00.000Z'), confidence: 0.85, anchors: [] },
      keywords: [{ value: 'ia', confidence: 0.89, anchors: [] }],
      doi: { value: '10.1000/demo', confidence: 0.87, anchors: [] },
      eventOrJournal: { value: 'Revista Demo', confidence: 0.86, anchors: [] },
      extractionSource: 'pdfjs_native',
      extractionConfidence: 0.9,
      evidenceCoverage: 0.55,
      nerProvider: 'cerebras',
      nerModel: 'gpt-oss-120b',
      nerAttemptTrace: [],
      extractedAt: new Date('2026-03-13T01:00:00.000Z'),
    })

    mockAcademicProductFindOne.mockResolvedValue(null)
    mockAcademicProductCreate.mockResolvedValue({
      _id: { toString: () => 'product-1' },
    })

    await processUploadedFile('upload-1')

    expect(mockExtractDocumentText).toHaveBeenCalledTimes(2)
    expect(uploadedFile.processingStatus).toBe('completed')
    expect(
      mockLogPipelineEvent.mock.calls.some(
        ([payload]) =>
          payload?.stage === 'ocr' &&
          payload?.event === 'quality_gate_retry_triggered' &&
          payload?.metadata?.qualityGateDecision === 'retry',
      ),
    ).toBe(true)
  })

  it('continues with warning when OCR remains poor after retry', async () => {
    const uploadedFile = createUploadedFileDoc()
    mockUploadedFileFindById.mockResolvedValue(uploadedFile)
    mockAtomicUploadedFileUpdates(uploadedFile)

    mockExtractDocumentText
      .mockResolvedValueOnce({
        text: '###',
        provider: 'pdfjs_native',
        confidence: 0.2,
        blocks: [],
      })
      .mockResolvedValueOnce({
        text: '### !!',
        provider: 'gemini_vision',
        modelId: 'gemini-2.5-flash',
        confidence: 0.21,
        blocks: [],
      })

    mockClassifyDocumentForNer.mockResolvedValue({
      productType: 'article',
      documentClassification: 'uncertain',
      classificationConfidence: 0.52,
      classificationRationale: 'Clasificacion incierta',
      classificationSource: 'llm',
    })

    mockExtractAcademicEntities.mockResolvedValue({
      productType: 'article',
      documentClassification: 'uncertain',
      classificationConfidence: 0.52,
      classificationRationale: 'Clasificacion incierta',
      classificationSource: 'llm',
      authors: [{ value: 'Ada Lovelace', confidence: 0.9, anchors: [] }],
      title: { value: 'Articulo de Prueba', confidence: 0.93, anchors: [] },
      institution: undefined,
      date: undefined,
      keywords: [{ value: 'ia', confidence: 0.89, anchors: [] }],
      doi: undefined,
      eventOrJournal: undefined,
      extractionSource: 'gemini_vision',
      extractionConfidence: 0.42,
      evidenceCoverage: 0.35,
      nerProvider: 'gemini',
      nerModel: 'gemini-2.5-flash',
      nerAttemptTrace: [],
      extractedAt: new Date('2026-03-13T01:00:00.000Z'),
    })

    mockAcademicProductFindOne.mockResolvedValue(null)
    mockAcademicProductCreate.mockResolvedValue({
      _id: { toString: () => 'product-1' },
    })

    await processUploadedFile('upload-1')

    expect(uploadedFile.processingStatus).toBe('completed')
    expect(mockNotifyDocumentProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        warningMessage: expect.stringContaining(
          'lectura automática del archivo sigue viéndose poco clara',
        ),
      }),
    )
    expect(
      mockLogPipelineEvent.mock.calls.some(
        ([payload]) =>
          payload?.stage === 'ocr' &&
          payload?.event === 'quality_gate_retry_exhausted_with_warning',
      ),
    ).toBe(true)
  })

  it('drops invalid patent grant date during product-specific post-validation', async () => {
    const uploadedFile = createUploadedFileDoc()
    mockUploadedFileFindById.mockResolvedValue(uploadedFile)
    mockAtomicUploadedFileUpdates(uploadedFile)

    mockExtractDocumentText.mockResolvedValue({
      text: 'Documento de patente academica',
      provider: 'pdfjs_native',
      confidence: 0.91,
      blocks: [],
    })

    mockClassifyDocumentForNer.mockResolvedValue({
      productType: 'patent',
      documentClassification: 'academic',
      classificationConfidence: 0.93,
      classificationRationale: 'Patente academica',
      classificationSource: 'llm',
    })

    mockExtractAcademicEntities.mockResolvedValue({
      productType: 'patent',
      documentClassification: 'academic',
      classificationConfidence: 0.93,
      classificationRationale: 'Patente academica',
      classificationSource: 'llm',
      authors: [{ value: 'Ada Lovelace', confidence: 0.9, anchors: [] }],
      title: { value: 'Patente Demo', confidence: 0.93, anchors: [] },
      institution: { value: 'Universidad Demo', confidence: 0.88, anchors: [] },
      date: { value: new Date('2026-03-13T00:00:00.000Z'), confidence: 0.85, anchors: [] },
      keywords: [{ value: 'patente', confidence: 0.89, anchors: [] }],
      doi: undefined,
      eventOrJournal: undefined,
      extractionSource: 'pdfjs_native',
      extractionConfidence: 0.9,
      evidenceCoverage: 0.55,
      nerProvider: 'cerebras',
      nerModel: 'gpt-oss-120b',
      nerAttemptTrace: [],
      extractedAt: new Date('2026-03-13T01:00:00.000Z'),
    })

    mockExtractProductSpecificMetadata.mockResolvedValue({
      patentApplicationDate: '2026-03-10',
      patentGrantDate: '2026-02-10',
      patentStatus: 'granted',
    })

    mockAcademicProductFindOne.mockResolvedValue(null)
    mockAcademicProductCreate.mockResolvedValue({
      _id: { toString: () => 'product-1' },
    })

    await processUploadedFile('upload-1')

    expect(mockAcademicProductCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        patentApplicationDate: expect.any(Date),
        patentGrantDate: undefined,
      }),
    )
    expect(
      mockLogPipelineEvent.mock.calls.some(
        ([payload]) =>
          payload?.stage === 'ner' && payload?.event === 'product_specific_validation_adjusted',
      ),
    ).toBe(true)
  })

  it('rechaza subida duplicada antes del OCR si otro envío completado tiene el mismo digest y producto activo', async () => {
    const uploadedFile = createUploadedFileDoc({ processingStatus: 'processing' })
    mockUploadedFileFindById.mockResolvedValue(uploadedFile)
    mockAtomicUploadedFileUpdates(uploadedFile)

    mockUploadedFileFindOne.mockImplementation(() =>
      createUploadedFileFindOneDuplicateChain({ _id: { toString: () => 'blocking-upload' } }),
    )
    mockAcademicProductExists.mockResolvedValue({ _id: 'product-ref' })

    await processUploadedFile('upload-1')

    expect(mockExtractDocumentText).not.toHaveBeenCalled()
    expect(uploadedFile.processingStatus).toBe('error')
    expect(uploadedFile.processingError).toBe(UPLOAD_ERROR_DUPLICATE_IN_REPOSITORY)
    expect(mockLogPipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'rejected_duplicate_repository_file',
        metadata: expect.objectContaining({
          reason: 'precheck',
          blockingUploadedFileId: 'blocking-upload',
        }),
      }),
    )
  })

  it('continúa el pipeline si hay otro envío con el mismo digest pero sin productos activos', async () => {
    const uploadedFile = createUploadedFileDoc({ processingStatus: 'processing' })
    mockUploadedFileFindById.mockResolvedValue(uploadedFile)
    mockAtomicUploadedFileUpdates(uploadedFile)

    mockUploadedFileFindOne.mockImplementation(() =>
      createUploadedFileFindOneDuplicateChain({ _id: { toString: () => 'orphan-upload' } }),
    )
    mockAcademicProductExists.mockResolvedValue(null)

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
      classificationSource: 'llm',
      authors: [{ value: 'Ada Lovelace', confidence: 0.9, anchors: [] }],
      title: { value: 'Articulo de Prueba', confidence: 0.93, anchors: [] },
      institution: { value: 'Universidad Demo', confidence: 0.88, anchors: [] },
      date: { value: new Date('2026-03-13T00:00:00.000Z'), confidence: 0.85, anchors: [] },
      keywords: [{ value: 'ia', confidence: 0.89, anchors: [] }],
      doi: { value: '10.1000/demo', confidence: 0.87, anchors: [] },
      eventOrJournal: { value: 'Revista Demo', confidence: 0.86, anchors: [] },
      extractionSource: 'pdfjs_native',
      extractionConfidence: 0.9,
      evidenceCoverage: 0.55,
      nerProvider: 'cerebras',
      nerModel: 'gpt-oss-120b',
      nerAttemptTrace: [],
      extractedAt: new Date('2026-03-13T01:00:00.000Z'),
    })

    mockExtractProductSpecificMetadata.mockResolvedValue({})

    mockAcademicProductFindOne.mockResolvedValue(null)
    mockAcademicProductCreate.mockResolvedValue({
      _id: { toString: () => 'product-1' },
    })

    await processUploadedFile('upload-1')

    expect(mockExtractDocumentText).toHaveBeenCalled()
    expect(uploadedFile.processingStatus).toBe('completed')
  })
})
