export function normalizePublicationLanguageForMongo(
  raw: string | undefined | null,
): string | undefined {
  if (raw == null) {
    return undefined
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return undefined
  }

  const v = trimmed.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

  const spanish = new Set([
    'es',
    'espanol',
    'spanish',
    'castellano',
    'castillian',
    'idioma espanol',
  ])
  if (spanish.has(v)) {
    return 'spanish'
  }

  const english = new Set(['en', 'english', 'ingles', 'inglés'])
  if (english.has(v)) {
    return 'english'
  }

  const french = new Set(['fr', 'french', 'frances', 'francais', 'français'])
  if (french.has(v)) {
    return 'french'
  }

  const portuguese = new Set(['pt', 'portuguese', 'portugues', 'português', 'portugues brasil'])
  if (portuguese.has(v)) {
    return 'portuguese'
  }

  const german = new Set(['de', 'german', 'deutsch', 'aleman', 'alemán'])
  if (german.has(v)) {
    return 'german'
  }

  const italian = new Set(['it', 'italian', 'italiano'])
  if (italian.has(v)) {
    return 'italian'
  }

  const validMongo = new Set([
    'danish',
    'dutch',
    'finnish',
    'hungarian',
    'norwegian',
    'romanian',
    'russian',
    'swedish',
    'turkish',
    'none',
  ])
  if (validMongo.has(v)) {
    return v
  }

  return undefined
}
