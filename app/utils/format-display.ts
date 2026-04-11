/** Formateo legible para UI (tamaños, duraciones, porcentajes). */

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function formatConfidence(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'No disponible'
  }
  return `${Math.round(value * 100)}%`
}

export function formatDuration(durationMs: number | null): string {
  if (!durationMs || durationMs < 0) {
    return 'No disponible'
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`
  }
  const seconds = durationMs / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes} min ${remainingSeconds}s`
}

export function toTimestamp(value?: string): number | null {
  if (!value) {
    return null
  }
  const resolved = new Date(value).getTime()
  return Number.isNaN(resolved) ? null : resolved
}
