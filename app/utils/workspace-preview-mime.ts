const OFFICE_EXTENSION_TO_MIME: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  docm: 'application/vnd.ms-word.document.macroenabled.12',
  dotm: 'application/vnd.ms-word.template.macroenabled.12',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroenabled.12',
  xltx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  xltm: 'application/vnd.ms-excel.template.macroenabled.12',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  potx: 'application/vnd.openxmlformats-officedocument.presentationml.template',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  pptm: 'application/vnd.ms-powerpoint.presentation.macroenabled.12',
  potm: 'application/vnd.ms-powerpoint.template.macroenabled.12',
  ppsm: 'application/vnd.ms-powerpoint.slideshow.macroenabled.12',
  odt: 'application/vnd.oasis.opendocument.text',
  ott: 'application/vnd.oasis.opendocument.text-template',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  ots: 'application/vnd.oasis.opendocument.spreadsheet-template',
  odp: 'application/vnd.oasis.opendocument.presentation',
  otp: 'application/vnd.oasis.opendocument.presentation-template',
}

export function inferMimeTypeFromFilename(filename: string): string {
  const normalized = filename.trim().toLowerCase()
  if (normalized.endsWith('.pdf')) {
    return 'application/pdf'
  }
  if (normalized.endsWith('.png')) {
    return 'image/png'
  }
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  const dot = normalized.lastIndexOf('.')
  if (dot !== -1) {
    const ext = normalized.slice(dot + 1)
    const office = OFFICE_EXTENSION_TO_MIME[ext]
    if (office) {
      return office
    }
  }
  return ''
}

/** MIME efectivo para la vista previa: evita '' del servidor, x-pdf, octet-stream y tipos vacíos del input file. */
export function resolveWorkspacePreviewMime(raw: string | undefined, filename: string): string {
  const trimmed = raw?.trim()
  if (trimmed) {
    const mainType = (trimmed.split(';')[0] ?? trimmed).trim()
    const base = mainType.toLowerCase()
    if (base === 'application/pdf' || base === 'application/x-pdf') {
      return 'application/pdf'
    }
    if (base.startsWith('image/')) {
      return mainType
    }
    if (base === 'application/octet-stream') {
      const inferred = inferMimeTypeFromFilename(filename)
      if (inferred) {
        return inferred
      }
    }
    return mainType
  }
  return inferMimeTypeFromFilename(filename)
}
