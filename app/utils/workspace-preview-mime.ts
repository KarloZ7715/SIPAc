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
