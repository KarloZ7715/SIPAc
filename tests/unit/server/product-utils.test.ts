import { describe, expect, it } from 'vitest'
import { buildProductWorkspaceDraft } from '../../../server/utils/product'

describe('buildProductWorkspaceDraft', () => {
  it('normalizes product and upload data for the workspace draft contract', () => {
    const draft = buildProductWorkspaceDraft(
      {
        _id: { toString: () => 'product-1' },
        productType: 'article',
        owner: { toString: () => 'user-1' },
        sourceFile: { toString: () => 'upload-1' },
        reviewStatus: 'draft',
        extractedEntities: {
          authors: [{ value: 'Ada Lovelace', confidence: 0.9, anchors: [] }],
          title: { value: 'Articulo de prueba', confidence: 0.9, anchors: [] },
          institution: { value: 'Universidad de Córdoba', confidence: 0.9, anchors: [] },
          date: { value: new Date('2026-03-12T00:00:00.000Z'), confidence: 0.9, anchors: [] },
          keywords: [{ value: 'ia', confidence: 0.9, anchors: [] }],
          doi: { value: '10.1234/demo', confidence: 0.9, anchors: [] },
          eventOrJournal: { value: 'Revista Demo', confidence: 0.9, anchors: [] },
          extractionSource: 'pdfjs_native',
          extractionConfidence: 0.91,
          extractedAt: new Date('2026-03-12T01:00:00.000Z'),
        },
        manualMetadata: {
          title: 'Articulo revisado',
          authors: ['Ada Lovelace'],
          institution: 'Universidad de Córdoba',
          date: new Date('2026-03-12T00:00:00.000Z'),
          doi: '10.1234/demo',
          keywords: ['ia'],
          notes: 'Notas',
        },
        isDeleted: false,
        createdAt: new Date('2026-03-12T02:00:00.000Z'),
        updatedAt: new Date('2026-03-12T03:00:00.000Z'),
      },
      {
        _id: { toString: () => 'upload-1' },
        originalFilename: 'archivo.pdf',
        productType: 'article',
        mimeType: 'application/pdf',
        fileSizeBytes: 2048,
        processingStatus: 'completed',
        rawExtractedText: 'Texto OCR',
        ocrProvider: 'pdfjs_native',
        ocrConfidence: 0.98,
        createdAt: new Date('2026-03-12T00:30:00.000Z'),
      },
    )

    expect(draft.product._id).toBe('product-1')
    expect(draft.product.owner).toBe('user-1')
    expect(draft.product.reviewStatus).toBe('draft')
    expect(draft.product.extractedEntities.extractedAt).toBe('2026-03-12T01:00:00.000Z')
    expect(draft.uploadedFile._id).toBe('upload-1')
    expect(draft.uploadedFile.academicProductId).toBe('product-1')
    expect(draft.uploadedFile.reviewStatus).toBe('draft')
  })
})
