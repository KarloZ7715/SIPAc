/** Utilidades puras para mapeo de subtipos en el workspace (testables sin Vue). */

export function splitMultivalue(value: string): string[] | undefined {
  if (value.trim().length === 0) {
    return undefined
  }

  return value
    .split(/,|\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function toIsoDate(value: string): string | undefined {
  if (!value) {
    return undefined
  }

  return new Date(value).toISOString()
}

export function toNumberValue(value: string): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
