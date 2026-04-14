import JSZip from 'jszip'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import type { AllowedMimeType } from '~~/app/types'
import { resolveStructuredOfficeMimeType } from '~~/app/types'

function normalizeOfficeText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
}

function isOpenDocumentTextFamily(mime: string): boolean {
  return (
    mime === 'application/vnd.oasis.opendocument.text' ||
    mime === 'application/vnd.oasis.opendocument.text-template'
  )
}

function isOpenDocumentSpreadsheetFamily(mime: string): boolean {
  return (
    mime === 'application/vnd.oasis.opendocument.spreadsheet' ||
    mime === 'application/vnd.oasis.opendocument.spreadsheet-template'
  )
}

function isOpenDocumentPresentationFamily(mime: string): boolean {
  return (
    mime === 'application/vnd.oasis.opendocument.presentation' ||
    mime === 'application/vnd.oasis.opendocument.presentation-template'
  )
}

function isWordOpenXmlFamily(mime: string): boolean {
  return (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' ||
    mime === 'application/vnd.ms-word.document.macroenabled.12' ||
    mime === 'application/vnd.ms-word.template.macroenabled.12'
  )
}

/** Solo Excel OOXML / macro; ODS/OTS se tratan como ODF (content.xml), no con SheetJS. */
function isExcelOpenXmlFamily(mime: string): boolean {
  return (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.template' ||
    mime === 'application/vnd.ms-excel.sheet.macroenabled.12' ||
    mime === 'application/vnd.ms-excel.template.macroenabled.12'
  )
}

function isPresentationOpenXmlFamily(mime: string): boolean {
  return (
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.slideshow' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.template' ||
    mime === 'application/vnd.ms-powerpoint.presentation.macroenabled.12' ||
    mime === 'application/vnd.ms-powerpoint.template.macroenabled.12' ||
    mime === 'application/vnd.ms-powerpoint.slideshow.macroenabled.12'
  )
}

async function extractOpenDocumentContentXmlText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const content = zip.file('content.xml')
  if (!content) {
    throw new Error('Archivo ODF inválido: falta content.xml')
  }
  const xml = await content.async('string')
  const withBreaks = xml
    .replace(/<text:tab[^/>]*\/?>/g, '\t')
    .replace(/<text:line-break[^/>]*\/?>/g, '\n')
  const stripped = withBreaks.replace(/<[^>]+>/g, ' ')
  return normalizeOfficeText(stripped)
}

async function extractWordOpenXmlText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer })
  return normalizeOfficeText(value)
}

async function extractSpreadsheetText(buffer: Buffer): Promise<string> {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellStyles: false,
  })
  if (!workbook.SheetNames.length) {
    return ''
  }
  const parts: string[] = []
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n' })
    if (csv.trim()) {
      parts.push(`## ${name}\n${csv}`)
    }
  }
  return normalizeOfficeText(parts.join('\n\n'))
}

async function extractOpenXmlPresentationText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const paths = Object.keys(zip.files)
    .filter((p) => /^ppt\/(slides\/slide\d+\.xml|notesSlides\/notesSlide\d+\.xml)$/.test(p))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const chunks: string[] = []
  for (const path of paths) {
    const file = zip.file(path)
    if (!file) continue
    const xml = await file.async('string')
    for (const match of xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)) {
      const piece = match[1]?.trim()
      if (piece) chunks.push(piece)
    }
  }
  return normalizeOfficeText(chunks.join('\n'))
}

export async function extractOfficeStructuredText(
  buffer: Buffer,
  mimeType: AllowedMimeType,
): Promise<string> {
  const canonical = resolveStructuredOfficeMimeType(mimeType)
  if (!canonical) {
    throw new Error(`Tipo MIME no es documento Office estructurado: ${mimeType}`)
  }

  if (isWordOpenXmlFamily(canonical)) {
    return extractWordOpenXmlText(buffer)
  }

  if (isOpenDocumentTextFamily(canonical)) {
    return extractOpenDocumentContentXmlText(buffer)
  }

  if (isOpenDocumentSpreadsheetFamily(canonical)) {
    return extractOpenDocumentContentXmlText(buffer)
  }

  if (isExcelOpenXmlFamily(canonical)) {
    return extractSpreadsheetText(buffer)
  }

  if (isPresentationOpenXmlFamily(canonical)) {
    return extractOpenXmlPresentationText(buffer)
  }

  if (isOpenDocumentPresentationFamily(canonical)) {
    return extractOpenDocumentContentXmlText(buffer)
  }

  throw new Error(`Extracción Office no implementada para: ${canonical}`)
}
