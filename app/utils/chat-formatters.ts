import type {
  ChatEvidenceSnippet,
  ChatSearchResult,
  ChatSearchToolOutput,
  ChatUiMessage,
} from '~~/app/types'

export function formatChatTimestamp(timestamp?: number, locale = 'es-CO') {
  if (!timestamp) {
    return ''
  }

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export function formatChatProductType(productType: ChatSearchResult['productType']) {
  return (
    {
      article: 'Artículo',
      conference_paper: 'Ponencia',
      thesis: 'Tesis',
      certificate: 'Certificado',
      research_project: 'Proyecto',
      book: 'Libro',
      book_chapter: 'Capítulo',
      technical_report: 'Informe',
      software: 'Software',
      patent: 'Patente',
    }[productType] ?? productType
  )
}

export function formatChatSearchStrategy(strategy?: ChatSearchToolOutput['strategyUsed']) {
  return (
    {
      structured_exact: 'Coincidencia exacta',
      diagnostic_broadened: 'Búsqueda ampliada',
      ocr_full_text: 'Búsqueda en el texto del archivo',
    }[strategy ?? 'structured_exact'] ?? strategy
  )
}

export function formatChatMatchedField(field: string) {
  return (
    {
      'manualMetadata.title': 'Título',
      'extractedEntities.title.value': 'Título',
      'manualMetadata.authors': 'Autores',
      'extractedEntities.authors.value': 'Autores',
      director: 'Director',
      jurors: 'Jurados',
      principalInvestigatorName: 'Investigador principal',
      coResearchers: 'Coinvestigadores',
      'manualMetadata.institution': 'Institución',
      'extractedEntities.institution.value': 'Institución',
      university: 'Universidad',
      degreeGrantor: 'Otorgante de grado',
      eventSponsor: 'Patrocinador del evento',
      publisher: 'Editorial / publisher',
      reportInstitution: 'Institución del informe',
      reportSponsor: 'Patrocinador del informe',
      issuingEntity: 'Entidad emisora',
      institution: 'Institución del proyecto',
      bookPublisher: 'Editorial del libro',
      chapterPublisher: 'Editorial del capítulo',
      patentAssignee: 'Titular de patente',
      'manualMetadata.keywords': 'Palabras clave',
      'extractedEntities.keywords.value': 'Palabras clave',
      areaOfKnowledge: 'Área de conocimiento',
      reportAreaOfKnowledge: 'Área del informe',
      keywords: 'Keywords del proyecto',
      'extractedEntities.eventOrJournal.value': 'Evento o revista extraído',
      journalName: 'Revista',
      eventName: 'Evento',
      proceedingsTitle: 'Memorias / proceedings',
      programOrCall: 'Programa o convocatoria',
      relatedEvent: 'Evento relacionado',
      softwareProgrammingLanguage: 'Lenguaje de programación',
      softwarePlatform: 'Plataforma',
      patentClassification: 'Clasificación de patente',
      'manualMetadata.notes': 'Notas manuales',
      degreeName: 'Nombre del grado',
      faculty: 'Facultad',
      projectCode: 'Código de proyecto',
      conferenceAcronym: 'Sigla de congreso',
      journalAbbreviation: 'Abreviatura de revista',
      bookCollection: 'Colección',
      reportRevision: 'Revisión de informe',
      softwareLicense: 'Licencia de software',
      softwareType: 'Tipo de software',
      patentOffice: 'Oficina de patente',
      patentCountry: 'País de patente',
      rawExtractedText: 'Fragmento localizado',
    }[field] ?? field
  )
}

/** Evita repetir la misma etiqueta+texto (p. ej. institución en ficha y en extracción). */
export function dedupeEvidenceSnippetsForDisplay(
  snippets: ChatEvidenceSnippet[],
  maxItems: number,
): Array<{ label: string; text: string }> {
  const out: Array<{ label: string; text: string }> = []
  const seen = new Set<string>()

  for (const snippet of snippets) {
    const label =
      snippet.source === 'ocr_text'
        ? 'Extracto del documento'
        : formatChatMatchedField(snippet.field || 'Información')
    const text = snippet.text.trim()
    if (!text) {
      continue
    }
    const key = `${label}\u0000${text}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push({ label, text })
    if (out.length >= maxItems) {
      break
    }
  }

  return out
}

function formatFilterValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return String(value)
}

export function visibleChatFilterEntries(filters: ChatSearchToolOutput['normalizedFilters']) {
  return [
    ['Tipo', formatFilterValue(filters.productType && formatChatProductType(filters.productType))],
    ['Institución', formatFilterValue(filters.institution)],
    ['Autor', formatFilterValue(filters.author)],
    ['Título', formatFilterValue(filters.title)],
    ['Tema', formatFilterValue(filters.keyword ?? filters.search)],
    ['Desde', formatFilterValue(filters.yearFrom ?? filters.dateFrom)],
    ['Hasta', formatFilterValue(filters.yearTo ?? filters.dateTo)],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))
}

export function isDuplicateChatToolPart(message: ChatUiMessage, index: number) {
  const part = message.parts[index]
  if (part?.type !== 'tool-searchRepositoryProducts' || part.state !== 'output-available') {
    return false
  }

  return message.parts.slice(0, index).some((previousPart) => {
    return (
      previousPart.type === 'tool-searchRepositoryProducts' &&
      previousPart.state === 'output-available' &&
      previousPart.output.toolCallKey === part.output.toolCallKey
    )
  })
}
