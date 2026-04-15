import { describe, expect, it } from 'vitest'
import { workspaceDocumentsUrl } from '~~/server/utils/dashboard-workspace-links'

describe('workspaceDocumentsUrl', () => {
  it('incluye productId y focus', () => {
    expect(workspaceDocumentsUrl({ productId: 'abc', focus: 'repositoryUrl' })).toBe(
      '/workspace-documents?productId=abc&focus=repositoryUrl',
    )
  })

  it('sin args devuelve ruta base', () => {
    expect(workspaceDocumentsUrl({})).toBe('/workspace-documents')
  })

  it('añade extraParams', () => {
    expect(
      workspaceDocumentsUrl({
        productId: 'p1',
        focus: 'doi',
        extraParams: { fromInsight: 'low-confidence-ner' },
      }),
    ).toBe('/workspace-documents?productId=p1&focus=doi&fromInsight=low-confidence-ner')
  })

  it('omite valores extra vacíos', () => {
    expect(
      workspaceDocumentsUrl({
        productId: 'p1',
        extraParams: { fromInsight: '' },
      }),
    ).toBe('/workspace-documents?productId=p1')
  })
})
