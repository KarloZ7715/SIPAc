import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductWorkspaceDraftDTO } from '~~/app/types'
import { useDocumentsStore } from '~~/app/stores/documents'

function createDraftSnapshot(
  overrides?: Partial<ProductWorkspaceDraftDTO>,
): ProductWorkspaceDraftDTO {
  return {
    product: {
      _id: 'product-1',
      productType: 'article',
      owner: 'user-1',
      sourceFile: 'upload-1',
      reviewStatus: 'draft',
      extractedEntities: {
        authors: [{ value: 'Ada Lovelace', confidence: 0.9, anchors: [] }],
        title: { value: 'Articulo detectado', confidence: 0.9, anchors: [] },
        institution: { value: 'Universidad de Córdoba', confidence: 0.9, anchors: [] },
        date: { value: '2026-03-12T00:00:00.000Z', confidence: 0.9, anchors: [] },
        keywords: [{ value: 'ia', confidence: 0.9, anchors: [] }],
        doi: { value: '10.1234/demo', confidence: 0.9, anchors: [] },
        eventOrJournal: { value: 'Revista Demo', confidence: 0.9, anchors: [] },
        extractionSource: 'pdfjs_native',
        extractionConfidence: 0.9,
        extractedAt: '2026-03-12T01:00:00.000Z',
      },
      manualMetadata: {
        title: 'Articulo detectado',
        authors: ['Ada Lovelace'],
        institution: 'Universidad de Córdoba',
        date: '2026-03-12T00:00:00.000Z',
        doi: '10.1234/demo',
        keywords: ['ia'],
        notes: 'Notas iniciales',
      },
      isDeleted: false,
      createdAt: '2026-03-12T02:00:00.000Z',
      updatedAt: '2026-03-12T03:00:00.000Z',
    },
    uploadedFile: {
      _id: 'upload-1',
      originalFilename: 'archivo.pdf',
      productType: 'article',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
      processingStatus: 'completed',
      rawExtractedText: 'Texto OCR',
      ocrProvider: 'pdfjs_native',
      ocrConfidence: 0.98,
      academicProductId: 'product-1',
      reviewStatus: 'draft',
      createdAt: '2026-03-12T00:30:00.000Z',
    },
    ...overrides,
  }
}

describe('useDocumentsStore', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
    vi.stubGlobal('$fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useDocumentsStore().stopPolling()
  })

  it('hydrates the persisted draft after a completed upload status', async () => {
    const store = useDocumentsStore()
    const file = new File(['demo'], 'archivo.pdf', { type: 'application/pdf' })
    const draft = createDraftSnapshot()

    fetchMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          uploadedFile: {
            _id: 'upload-1',
            originalFilename: 'archivo.pdf',
            productType: 'article',
            mimeType: 'application/pdf',
            fileSizeBytes: 2048,
            processingStatus: 'pending',
            createdAt: '2026-03-12T00:00:00.000Z',
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          processingStatus: 'completed',
          academicProductId: 'product-1',
          reviewStatus: 'draft',
          rawExtractedText: 'Texto OCR',
        },
      })
      .mockResolvedValueOnce({ success: true, data: { draft } })

    await store.uploadDocument(file, 'article')

    expect(store.activeAcademicProductId).toBe('product-1')
    expect(store.draftProduct?.product.reviewStatus).toBe('draft')
    expect(store.workspaceDetectedMetadata.title).toBe('Articulo detectado')
    expect(store.workspaceStage).toBe('ready')
  })

  it('loads the current draft when the user resumes the flow', async () => {
    const store = useDocumentsStore()
    const draft = createDraftSnapshot()

    fetchMock.mockResolvedValueOnce({ success: true, data: { draft } })

    await store.loadCurrentDraft()

    expect(store.activeUploadId).toBe('upload-1')
    expect(store.draftProduct?.uploadedFile.originalFilename).toBe('archivo.pdf')
    expect(store.workspaceStage).toBe('ready')
  })

  it('usa un fetcher inyectado para recuperar el borrador actual en SSR', async () => {
    const store = useDocumentsStore()
    const draft = createDraftSnapshot()
    const requestFetchMock = vi.fn().mockResolvedValueOnce({ success: true, data: { draft } })

    await store.loadCurrentDraft(requestFetchMock)

    expect(requestFetchMock).toHaveBeenCalledWith(
      '/api/products/drafts/current',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(store.activeUploadId).toBe('upload-1')
    expect(store.workspaceStage).toBe('ready')
  })

  it('confirms the draft and moves the workspace to confirmed', async () => {
    const store = useDocumentsStore()
    const confirmedDraft = createDraftSnapshot({
      product: {
        ...createDraftSnapshot().product,
        reviewStatus: 'confirmed',
        reviewConfirmedAt: '2026-03-12T04:00:00.000Z',
      },
      uploadedFile: {
        ...createDraftSnapshot().uploadedFile,
        reviewStatus: 'confirmed',
      },
    })

    fetchMock.mockResolvedValueOnce({ success: true, data: { draft: createDraftSnapshot() } })
    await store.loadCurrentDraft()

    fetchMock.mockResolvedValueOnce({ success: true, data: { draft: confirmedDraft } })
    await store.confirmDraft()

    expect(store.draftProduct?.product.reviewStatus).toBe('confirmed')
    expect(store.workspaceStage).toBe('confirmed')
  })

  it('cancels the persisted draft and clears the workspace state', async () => {
    const store = useDocumentsStore()

    fetchMock.mockResolvedValueOnce({ success: true, data: { draft: createDraftSnapshot() } })
    await store.loadCurrentDraft()

    fetchMock.mockResolvedValueOnce({
      success: true,
      data: { message: 'Archivo eliminado correctamente' },
    })
    await store.cancelDraft()

    expect(store.activeUploadId).toBeNull()
    expect(store.draftProduct).toBeNull()
    expect(store.workspaceStage).toBe('empty')
  })

  it('requires title and at least one author to confirm', async () => {
    const store = useDocumentsStore()

    fetchMock.mockResolvedValueOnce({ success: true, data: { draft: createDraftSnapshot() } })
    await store.loadCurrentDraft()

    store.updateDetectedMetadata({ title: '   ', authors: ['Ada Lovelace'] })
    expect(store.canConfirmDraft).toBe(false)

    store.updateDetectedMetadata({ title: 'Titulo valido', authors: ['   '] })
    expect(store.canConfirmDraft).toBe(false)

    store.updateDetectedMetadata({ title: 'Titulo valido', authors: ['Ada Lovelace'] })
    expect(store.canConfirmDraft).toBe(true)
  })
})
