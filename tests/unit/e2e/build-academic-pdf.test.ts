import { fileTypeFromBuffer } from 'file-type'
import { describe, expect, it } from 'vitest'
import { buildAcademicPdfBuffer } from '../../e2e/helpers/build-academic-pdf'

describe('buildAcademicPdfBuffer', () => {
  it('produce un PDF reconocido por file-type', async () => {
    const buffer = buildAcademicPdfBuffer()
    const detected = await fileTypeFromBuffer(buffer)
    expect(detected?.mime).toBe('application/pdf')
    expect(buffer.length).toBeGreaterThan(200)
  })
})
