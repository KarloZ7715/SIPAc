import { isStructuredOfficeMimeType } from '~~/app/types'

/** Etiqueta corta para resúmenes del flujo de documentos de trabajo. */
export function getWorkspaceDocumentFormatLabel(mime: string, isImage: boolean): string {
  if (isImage) {
    return 'Imagen'
  }
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? ''
  if (base === 'application/pdf' || base === 'application/x-pdf') {
    return 'PDF'
  }
  if (isStructuredOfficeMimeType(base)) {
    return 'Office (Word, Excel, PowerPoint o ODF)'
  }
  return 'Documento'
}
