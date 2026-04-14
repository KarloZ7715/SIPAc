import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { extractOfficeStructuredText } from '~~/server/services/ocr/extract-office-structured-text'

describe('extractOfficeStructuredText', () => {
  it('extrae texto de un .xlsx generado en memoria', async () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Título', 'Autores'],
      ['Ejemplo NER', 'Ana · Luis'],
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, 'Hoja1')
    const written = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const buffer = Buffer.isBuffer(written) ? written : Buffer.from(written as Uint8Array)

    const text = await extractOfficeStructuredText(
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )

    expect(text).toContain('Ejemplo NER')
    expect(text).toContain('Hoja1')
  })

  it('rechaza tipos que no son Office estructurado', async () => {
    await expect(extractOfficeStructuredText(Buffer.from('x'), 'application/pdf')).rejects.toThrow(
      /no es documento Office estructurado/,
    )
  })
})
