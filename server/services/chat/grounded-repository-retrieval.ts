import type {
  AcademicProductPublic,
  ChatEvidenceSnippet,
  ChatSearchDiagnosticInfo,
  ChatSearchFilters,
  ChatSearchResult,
  ChatSearchStrategy,
  ChatSearchToolInput,
  ChatSearchToolOutput,
  ProductType,
} from '~~/app/types'
import { formatChatProductType } from '~~/app/utils/chat-formatters'
import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import {
  CONFIRMED_REPOSITORY_AUTHOR_FIELDS,
  CONFIRMED_REPOSITORY_GENERIC_SEARCH_FIELDS,
  CONFIRMED_REPOSITORY_INSTITUTION_FIELDS,
  CONFIRMED_REPOSITORY_KEYWORD_FIELDS,
  CONFIRMED_REPOSITORY_TITLE_FIELDS,
  normalizeConfirmedRepositoryFilters,
  searchConfirmedRepositoryProducts,
} from '~~/server/services/products/confirmed-repository-search'
import { toAcademicProductPublic } from '~~/server/utils/product'

const PRODUCT_TYPE_ALIASES: Record<ProductType, string[]> = {
  article: ['articulo', 'articulos', 'artículo', 'artículos', 'article', 'articles', 'paper'],
  conference_paper: [
    'ponencia',
    'ponencias',
    'conference paper',
    'conference papers',
    'congreso',
    'congresos',
    'proceeding',
    'proceedings',
  ],
  thesis: ['tesis', 'thesis', 'disertacion', 'disertación', 'trabajo de grado'],
  certificate: ['certificado', 'certificados', 'certificate', 'certificates'],
  research_project: ['proyecto', 'proyectos', 'research project', 'research projects'],
  book: ['libro', 'libros', 'book', 'books'],
  book_chapter: ['capitulo', 'capítulos', 'capitulo de libro', 'chapter', 'book chapter'],
  technical_report: ['informe tecnico', 'informes tecnicos', 'technical report', 'report'],
  software: ['software', 'aplicacion', 'aplicaciones', 'application', 'applications'],
  patent: ['patente', 'patentes', 'patent', 'patents'],
}

const QUESTION_STOPWORDS = new Set([
  'que',
  'qué',
  'cuales',
  'cuáles',
  'cual',
  'cuál',
  'muéstrame',
  'muestrame',
  'muestra',
  'buscar',
  'busca',
  'buscarme',
  'dime',
  'necesito',
  'quiero',
  'ver',
  'sobre',
  'relacionados',
  'relacionadas',
  'relacionado',
  'relacionada',
  'asociados',
  'asociadas',
  'asociado',
  'asociada',
  'confirmadas',
  'confirmados',
  'confirmado',
  'confirmada',
  'repositorio',
  'sipac',
  'entre',
  'desde',
  'hasta',
  'del',
  'de',
  'la',
  'el',
  'los',
  'las',
  'y',
  'o',
  'en',
  'con',
  'por',
  'para',
  'un',
  'una',
  'unos',
  'unas',
])

interface RepositoryFieldDescriptor {
  path: string
  values: string[]
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .filter((value, index, list) => list.indexOf(value) === index)
}

function normalizeComparableText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function includesComparable(haystack: string | undefined, needle: string | undefined) {
  if (!haystack || !needle) {
    return false
  }

  return normalizeComparableText(haystack).includes(normalizeComparableText(needle))
}

function compactText(values: Array<string | undefined>) {
  return values.filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )
}

function resolveProductTitle(product: AcademicProductPublic) {
  return product.manualMetadata.title ?? product.extractedEntities.title?.value ?? 'Sin título'
}

function resolveProductAuthors(product: AcademicProductPublic) {
  return uniqueStrings([
    ...(product.manualMetadata.authors ?? []),
    ...(product.extractedEntities.authors?.map((author) => author.value) ?? []),
    product.director,
    product.principalInvestigatorName,
    ...(product.coResearchers ?? []),
    ...(product.jurors ?? []),
    ...(product.chapterEditors ?? []),
    ...(product.patentInventors ?? []),
  ])
}

function resolveProductInstitution(product: AcademicProductPublic) {
  return (
    product.manualMetadata.institution ??
    product.extractedEntities.institution?.value ??
    product.university ??
    product.degreeGrantor ??
    product.publisher ??
    product.eventSponsor ??
    product.reportInstitution ??
    product.issuingEntity ??
    product.researchProjectInstitution ??
    product.bookPublisher ??
    product.chapterPublisher ??
    product.patentAssignee ??
    undefined
  )
}

function resolveProductKeywords(product: AcademicProductPublic) {
  return uniqueStrings([
    ...(product.manualMetadata.keywords ?? []),
    ...(product.extractedEntities.keywords?.map((keyword) => keyword.value) ?? []),
    product.areaOfKnowledge,
    product.conferenceAreaOfKnowledge,
    product.thesisAreaOfKnowledge,
    product.researchProjectAreaOfKnowledge,
    product.reportAreaOfKnowledge,
    ...(product.researchProjectKeywords ?? []),
    product.eventName,
    product.journalName,
    product.proceedingsTitle,
    product.programOrCall,
    product.relatedEvent,
    product.softwareProgrammingLanguage,
    product.softwarePlatform,
    product.patentClassification,
  ])
}

function resolveProductReferenceDate(product: AcademicProductPublic) {
  return (
    product.manualMetadata.date ??
    product.extractedEntities.date?.value ??
    product.eventDate ??
    product.approvalDate ??
    product.issueDate ??
    product.startDate ??
    product.bookPublicationDate ??
    product.chapterPublicationDate ??
    product.reportPublicationDate ??
    product.softwareReleaseDate ??
    product.patentPublicationDate ??
    product.createdAt
  )
}

function buildSearchResultSummary(product: AcademicProductPublic) {
  const title = resolveProductTitle(product)
  const authors = resolveProductAuthors(product)
  const institution = resolveProductInstitution(product)
  const referenceDate = resolveProductReferenceDate(product)
  const year = referenceDate ? new Date(referenceDate).getUTCFullYear() : undefined

  return compactText([
    product.productType.replace(/_/g, ' '),
    authors.length ? `de ${authors.slice(0, 2).join(', ')}` : undefined,
    year ? `registrado en ${year}` : undefined,
    institution ? `asociado a ${institution}` : undefined,
    `con título "${title}"`,
  ]).join(' ')
}

function inferProductTypeFromQuestion(question: string): ProductType | undefined {
  const normalizedQuestion = normalizeComparableText(question)

  return (Object.entries(PRODUCT_TYPE_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => normalizedQuestion.includes(normalizeComparableText(alias))),
  )?.[0] ?? undefined) as ProductType | undefined
}

function inferInstitutionFromQuestion(question: string) {
  const match = question.match(
    /(universidad\s+de\s+[a-záéíóúñü0-9.\- ]{2,80}|instituci[oó]n\s+[a-záéíóúñü0-9.\- ]{2,80})/i,
  )

  return match?.[1]?.trim()
}

function inferYearRangeFromQuestion(question: string) {
  const normalizedQuestion = normalizeComparableText(question)
  const rangeMatch = normalizedQuestion.match(
    /\b(?:entre|de|desde)\s+(20\d{2}|19\d{2})\s+(?:a|al|hasta|y)\s+(20\d{2}|19\d{2})\b/,
  )

  if (rangeMatch) {
    return {
      yearFrom: Number(rangeMatch[1]),
      yearTo: Number(rangeMatch[2]),
    }
  }

  const singleYearMatch = normalizedQuestion.match(/\b(20\d{2}|19\d{2})\b/)
  if (singleYearMatch) {
    const year = Number(singleYearMatch[1])
    return { yearFrom: year, yearTo: year }
  }

  return {}
}

function inferSearchPhraseFromQuestion(question: string) {
  const normalizedQuestion = question.trim()
  const explicitMatch = normalizedQuestion.match(
    /(?:relacionad[oa]s?\s+con|sobre|acerca de|tema)\s+(.+?)(?:[?.!]|$)/i,
  )

  if (explicitMatch?.[1]) {
    return explicitMatch[1].trim()
  }

  const cleaned = normalizedQuestion
    .replace(/[¿?!.;,]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !QUESTION_STOPWORDS.has(normalizeComparableText(token)))
    .join(' ')
    .trim()

  return cleaned.length >= 6 ? cleaned : undefined
}

function buildNormalizedFilters(input: ChatSearchToolInput): ChatSearchFilters {
  const inferredYears = inferYearRangeFromQuestion(input.question)
  const inferredInstitution = inferInstitutionFromQuestion(input.question)
  const inferredSearch = inferSearchPhraseFromQuestion(input.question)

  return normalizeConfirmedRepositoryFilters({
    search: input.search ?? inferredSearch,
    title: input.title,
    author: input.author,
    institution: input.institution ?? inferredInstitution,
    keyword: input.keyword,
    productType: input.productType ?? inferProductTypeFromQuestion(input.question),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    yearFrom: input.yearFrom ?? inferredYears.yearFrom,
    yearTo: input.yearTo ?? inferredYears.yearTo,
  })
}

function buildToolCallKey(filters: ChatSearchFilters) {
  return JSON.stringify({
    productType: filters.productType ?? null,
    institution: filters.institution ?? null,
    author: filters.author ?? null,
    title: filters.title ?? null,
    keyword: filters.keyword ?? null,
    search: filters.search ?? null,
    dateFrom: filters.dateFrom ?? null,
    dateTo: filters.dateTo ?? null,
    yearFrom: filters.yearFrom ?? null,
    yearTo: filters.yearTo ?? null,
  })
}

function userRequestedRelatedResults(question: string) {
  return /(relacionad[oa]s?|similares?|alternativ[oa]s?|si no hay|si no existe)/i.test(question)
}

function buildProductFieldDescriptors(product: AcademicProductPublic): RepositoryFieldDescriptor[] {
  return [
    {
      path: 'manualMetadata.title',
      values: uniqueStrings([product.manualMetadata.title]),
    },
    {
      path: 'extractedEntities.title.value',
      values: uniqueStrings([product.extractedEntities.title?.value]),
    },
    {
      path: 'manualMetadata.authors',
      values: uniqueStrings(product.manualMetadata.authors),
    },
    {
      path: 'extractedEntities.authors.value',
      values: uniqueStrings(product.extractedEntities.authors?.map((author) => author.value) ?? []),
    },
    {
      path: 'director',
      values: uniqueStrings([product.director]),
    },
    {
      path: 'jurors',
      values: uniqueStrings(product.jurors ?? []),
    },
    {
      path: 'principalInvestigatorName',
      values: uniqueStrings([product.principalInvestigatorName]),
    },
    {
      path: 'coResearchers',
      values: uniqueStrings(product.coResearchers ?? []),
    },
    {
      path: 'chapterEditors',
      values: uniqueStrings(product.chapterEditors ?? []),
    },
    {
      path: 'patentInventors',
      values: uniqueStrings(product.patentInventors ?? []),
    },
    {
      path: 'manualMetadata.institution',
      values: uniqueStrings([product.manualMetadata.institution]),
    },
    {
      path: 'extractedEntities.institution.value',
      values: uniqueStrings([product.extractedEntities.institution?.value]),
    },
    {
      path: 'university',
      values: uniqueStrings([product.university]),
    },
    {
      path: 'degreeGrantor',
      values: uniqueStrings([product.degreeGrantor]),
    },
    {
      path: 'eventSponsor',
      values: uniqueStrings([product.eventSponsor]),
    },
    {
      path: 'publisher',
      values: uniqueStrings([product.publisher]),
    },
    {
      path: 'reportInstitution',
      values: uniqueStrings([product.reportInstitution]),
    },
    {
      path: 'reportSponsor',
      values: uniqueStrings([product.reportSponsor]),
    },
    {
      path: 'issuingEntity',
      values: uniqueStrings([product.issuingEntity]),
    },
    {
      path: 'institution',
      values: uniqueStrings([product.researchProjectInstitution]),
    },
    {
      path: 'bookPublisher',
      values: uniqueStrings([product.bookPublisher]),
    },
    {
      path: 'chapterPublisher',
      values: uniqueStrings([product.chapterPublisher]),
    },
    {
      path: 'patentAssignee',
      values: uniqueStrings([product.patentAssignee]),
    },
    {
      path: 'manualMetadata.keywords',
      values: uniqueStrings(product.manualMetadata.keywords),
    },
    {
      path: 'extractedEntities.keywords.value',
      values: uniqueStrings(
        product.extractedEntities.keywords?.map((keyword) => keyword.value) ?? [],
      ),
    },
    {
      path: 'areaOfKnowledge',
      values: uniqueStrings([
        product.areaOfKnowledge,
        product.conferenceAreaOfKnowledge,
        product.thesisAreaOfKnowledge,
        product.researchProjectAreaOfKnowledge,
      ]),
    },
    {
      path: 'reportAreaOfKnowledge',
      values: uniqueStrings([product.reportAreaOfKnowledge]),
    },
    {
      path: 'keywords',
      values: uniqueStrings(product.researchProjectKeywords ?? []),
    },
    {
      path: 'extractedEntities.eventOrJournal.value',
      values: uniqueStrings([product.extractedEntities.eventOrJournal?.value]),
    },
    {
      path: 'journalName',
      values: uniqueStrings([product.journalName]),
    },
    {
      path: 'eventName',
      values: uniqueStrings([product.eventName]),
    },
    {
      path: 'proceedingsTitle',
      values: uniqueStrings([product.proceedingsTitle]),
    },
    {
      path: 'programOrCall',
      values: uniqueStrings([product.programOrCall]),
    },
    {
      path: 'relatedEvent',
      values: uniqueStrings([product.relatedEvent]),
    },
    {
      path: 'softwareProgrammingLanguage',
      values: uniqueStrings([product.softwareProgrammingLanguage]),
    },
    {
      path: 'softwarePlatform',
      values: uniqueStrings([product.softwarePlatform]),
    },
    {
      path: 'patentClassification',
      values: uniqueStrings([product.patentClassification]),
    },
    {
      path: 'manualMetadata.notes',
      values: uniqueStrings([product.manualMetadata.notes]),
    },
    {
      path: 'degreeName',
      values: uniqueStrings([product.degreeName]),
    },
    {
      path: 'faculty',
      values: uniqueStrings([product.faculty]),
    },
    {
      path: 'projectCode',
      values: uniqueStrings([product.projectCode]),
    },
    {
      path: 'conferenceAcronym',
      values: uniqueStrings([product.conferenceAcronym]),
    },
    {
      path: 'journalAbbreviation',
      values: uniqueStrings([product.journalAbbreviation]),
    },
    {
      path: 'bookCollection',
      values: uniqueStrings([product.bookCollection]),
    },
    {
      path: 'reportRevision',
      values: uniqueStrings([product.reportRevision]),
    },
    {
      path: 'softwareLicense',
      values: uniqueStrings([product.softwareLicense]),
    },
    {
      path: 'softwareType',
      values: uniqueStrings([product.softwareType]),
    },
    {
      path: 'patentOffice',
      values: uniqueStrings([product.patentOffice]),
    },
    {
      path: 'patentCountry',
      values: uniqueStrings([product.patentCountry]),
    },
  ]
}

function buildMetadataEvidenceSnippets(
  product: AcademicProductPublic,
  normalizedFilters: ChatSearchFilters,
): ChatEvidenceSnippet[] {
  const descriptors = buildProductFieldDescriptors(product)
  const filterValues = uniqueStrings([
    normalizedFilters.institution,
    normalizedFilters.author,
    normalizedFilters.title,
    normalizedFilters.keyword,
    normalizedFilters.search,
  ])

  const snippets: ChatEvidenceSnippet[] = []

  for (const descriptor of descriptors) {
    for (const value of descriptor.values) {
      if (filterValues.some((filterValue) => includesComparable(value, filterValue))) {
        snippets.push({
          source: 'metadata',
          field: descriptor.path,
          text: value,
        })
      }
    }
  }

  return snippets.slice(0, 3)
}

function buildMatchedFields(product: AcademicProductPublic, normalizedFilters: ChatSearchFilters) {
  const matched = new Set<string>()
  const descriptors = buildProductFieldDescriptors(product)

  for (const descriptor of descriptors) {
    if (
      normalizedFilters.institution &&
      CONFIRMED_REPOSITORY_INSTITUTION_FIELDS.includes(descriptor.path as never) &&
      descriptor.values.some((value) => includesComparable(value, normalizedFilters.institution))
    ) {
      matched.add(descriptor.path)
    }

    if (
      normalizedFilters.author &&
      CONFIRMED_REPOSITORY_AUTHOR_FIELDS.includes(descriptor.path as never) &&
      descriptor.values.some((value) => includesComparable(value, normalizedFilters.author))
    ) {
      matched.add(descriptor.path)
    }

    if (
      normalizedFilters.title &&
      CONFIRMED_REPOSITORY_TITLE_FIELDS.includes(descriptor.path as never) &&
      descriptor.values.some((value) => includesComparable(value, normalizedFilters.title))
    ) {
      matched.add(descriptor.path)
    }

    if (
      normalizedFilters.keyword &&
      CONFIRMED_REPOSITORY_KEYWORD_FIELDS.includes(descriptor.path as never) &&
      descriptor.values.some((value) => includesComparable(value, normalizedFilters.keyword))
    ) {
      matched.add(descriptor.path)
    }

    if (
      normalizedFilters.search &&
      CONFIRMED_REPOSITORY_GENERIC_SEARCH_FIELDS.includes(descriptor.path as never) &&
      descriptor.values.some((value) => includesComparable(value, normalizedFilters.search))
    ) {
      matched.add(descriptor.path)
    }
  }

  return [...matched]
}

function buildSearchTerms(normalizedFilters: ChatSearchFilters, question: string) {
  const rawTerms = uniqueStrings([
    normalizedFilters.institution,
    normalizedFilters.author,
    normalizedFilters.title,
    normalizedFilters.keyword,
    normalizedFilters.search,
    inferSearchPhraseFromQuestion(question),
  ])

  const expandedTerms = rawTerms.flatMap((term) => {
    const pieces = term
      .split(/\s+/)
      .map((piece) => piece.trim())
      .filter((piece) => piece.length >= 4)

    return [term, ...pieces]
  })

  return uniqueStrings(expandedTerms).slice(0, 8)
}

function buildOcrSnippet(text: string, terms: string[]): string | undefined {
  const normalizedText = normalizeComparableText(text)
  const matchingTerm = terms.find((term) => normalizedText.includes(normalizeComparableText(term)))

  if (!matchingTerm) {
    return undefined
  }

  const rawIndex = normalizedText.indexOf(normalizeComparableText(matchingTerm))
  const start = Math.max(0, rawIndex - 100)
  const end = Math.min(text.length, rawIndex + matchingTerm.length + 100)
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

async function fetchSourceTextMap(sourceFileIds: string[]) {
  if (sourceFileIds.length === 0) {
    return new Map<string, string>()
  }

  const files = await UploadedFile.find(
    {
      _id: { $in: sourceFileIds },
      isDeleted: false,
    },
    { _id: 1, rawExtractedText: 1 },
  ).lean()

  return new Map(
    files
      .filter(
        (file) =>
          typeof file.rawExtractedText === 'string' && file.rawExtractedText.trim().length > 0,
      )
      .map((file) => [String(file._id), String(file.rawExtractedText)]),
  )
}

function toSearchResult(
  product: AcademicProductPublic,
  normalizedFilters: ChatSearchFilters,
  strategyUsed: ChatSearchStrategy,
  ocrText?: string,
  relatedReason?: string,
): ChatSearchResult {
  const referenceDate = resolveProductReferenceDate(product)
  const matchedFields = buildMatchedFields(product, normalizedFilters)
  const metadataEvidence = buildMetadataEvidenceSnippets(product, normalizedFilters)
  const ocrTerms = buildSearchTerms(normalizedFilters, '')
  const ocrSnippet = ocrText ? buildOcrSnippet(ocrText, ocrTerms) : undefined
  const evidenceSnippets = [
    ...metadataEvidence,
    ...(ocrSnippet
      ? [
          {
            source: 'ocr_text' as const,
            field: 'rawExtractedText',
            text: ocrSnippet,
          },
        ]
      : []),
  ].slice(0, 3)

  return {
    productId: product._id,
    sourceFileId: product.sourceFile,
    productType: product.productType,
    title: resolveProductTitle(product),
    authors: resolveProductAuthors(product),
    institution: resolveProductInstitution(product),
    year: referenceDate ? new Date(referenceDate).getUTCFullYear() : undefined,
    keywords: resolveProductKeywords(product),
    referenceDate,
    summary: buildSearchResultSummary(product),
    matchedFields,
    evidenceSnippets,
    score: matchedFields.length + evidenceSnippets.length,
    searchStrategy: strategyUsed,
    relatedReason,
    viewUrl: `/api/upload/${product.sourceFile}/file`,
    downloadUrl: `/api/upload/${product.sourceFile}/file?download=1`,
  }
}

async function enrichResults(
  products: AcademicProductPublic[],
  normalizedFilters: ChatSearchFilters,
  strategyUsed: ChatSearchStrategy,
  relatedReason?: string,
) {
  const sourceTextMap = await fetchSourceTextMap(products.map((product) => product.sourceFile))

  return products.map((product) =>
    toSearchResult(
      product,
      normalizedFilters,
      strategyUsed,
      sourceTextMap.get(product.sourceFile),
      relatedReason,
    ),
  )
}

async function runStructuredSearch(filters: ChatSearchFilters, limit: number) {
  const result = await searchConfirmedRepositoryProducts(filters, {
    page: 1,
    limit,
  })

  return {
    ...result,
    products: result.products.map(toAcademicProductPublic),
  }
}

async function runOcrFullTextSearch(
  normalizedFilters: ChatSearchFilters,
  question: string,
  limit: number,
): Promise<{
  products: AcademicProductPublic[]
  notes: string[]
  droppedFilters: Array<keyof ChatSearchFilters>
}> {
  const terms = buildSearchTerms(normalizedFilters, question)
  if (terms.length === 0) {
    return { products: [], notes: [], droppedFilters: [] }
  }

  const broadPattern = terms
    .slice(0, 4)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

  const candidateFiles = await UploadedFile.find(
    {
      isDeleted: false,
      rawExtractedText: { $regex: broadPattern, $options: 'i' },
    },
    { _id: 1, rawExtractedText: 1 },
  )
    .limit(40)
    .lean()

  if (candidateFiles.length === 0) {
    return {
      products: [],
      notes: [
        'No hubo coincidencias al revisar el texto completo de los archivos para ampliar la búsqueda.',
      ],
      droppedFilters: [],
    }
  }

  const scoredFiles = candidateFiles
    .map((file) => {
      const rawExtractedText =
        typeof file.rawExtractedText === 'string' ? file.rawExtractedText : ''
      const score = terms.reduce((acc, term) => {
        return acc + (includesComparable(rawExtractedText, term) ? 1 : 0)
      }, 0)

      return {
        sourceFileId: String(file._id),
        score,
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scoredFiles.length === 0) {
    return {
      products: [],
      notes: [
        'Se intentó ampliar la búsqueda leyendo más a fondo los archivos, pero no hubo coincidencias suficientes.',
      ],
      droppedFilters: [],
    }
  }

  const sourceFileIds = scoredFiles.map((item) => item.sourceFileId)
  const droppedFilters: Array<keyof ChatSearchFilters> = []
  const notes = [
    'Se amplió la búsqueda revisando también el texto completo dentro de los archivos.',
  ]

  const exactProducts = await AcademicProduct.find(
    {
      sourceFile: { $in: sourceFileIds },
      isDeleted: false,
      reviewStatus: 'confirmed',
      ...(normalizedFilters.productType ? { productType: normalizedFilters.productType } : {}),
    },
    {},
  )
    .limit(limit)
    .lean()

  let finalProducts = exactProducts
  if (finalProducts.length === 0 && normalizedFilters.productType) {
    droppedFilters.push('productType')
    notes.push(
      'No hubo coincidencias con el tipo de documento pedido al revisar el texto de los archivos; se probó una búsqueda más amplia sin ese filtro.',
    )

    finalProducts = await AcademicProduct.find(
      {
        sourceFile: { $in: sourceFileIds },
        isDeleted: false,
        reviewStatus: 'confirmed',
      },
      {},
    )
      .limit(limit)
      .lean()
  }

  return {
    products: finalProducts.map(toAcademicProductPublic),
    notes,
    droppedFilters,
  }
}

export async function executeGroundedRepositoryRetrieval(
  input: ChatSearchToolInput,
): Promise<ChatSearchToolOutput> {
  const safeLimit = Math.min(8, Math.max(1, input.limit ?? 6))
  const normalizedFilters = buildNormalizedFilters(input)
  const toolCallKey = buildToolCallKey(normalizedFilters)

  const exactSearch = await runStructuredSearch(normalizedFilters, safeLimit)
  if (exactSearch.total > 0) {
    const results = await enrichResults(exactSearch.products, normalizedFilters, 'structured_exact')

    return {
      filters: {
        search: input.search,
        title: input.title,
        author: input.author,
        institution: input.institution,
        keyword: input.keyword,
        productType: input.productType,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        yearFrom: input.yearFrom,
        yearTo: input.yearTo,
        limit: safeLimit,
      },
      normalizedFilters: {
        ...normalizedFilters,
        limit: safeLimit,
      },
      total: exactSearch.total,
      limitedTo: safeLimit,
      strategyUsed: 'structured_exact',
      matchedFields: uniqueStrings(results.flatMap((result) => result.matchedFields)),
      evidenceSnippets: results.flatMap((result) => result.evidenceSnippets).slice(0, 6),
      toolCallKey,
      diagnosticInfo: {
        broadened: false,
        droppedFilters: [],
        notes: [
          'La coincidencia se resolvió con búsqueda estructurada exacta sobre productos confirmados.',
        ],
      },
      results,
    }
  }

  const diagnosticInfo: ChatSearchDiagnosticInfo = {
    broadened: false,
    droppedFilters: [],
    notes: ['La búsqueda estructurada exacta no encontró coincidencias.'],
  }

  if (normalizedFilters.productType && userRequestedRelatedResults(input.question)) {
    diagnosticInfo.broadened = true
    diagnosticInfo.droppedFilters.push('productType')
    diagnosticInfo.notes.push(
      'Se amplió la búsqueda retirando temporalmente la restricción de tipo para localizar resultados relacionados.',
    )

    const broadenedFilters: ChatSearchFilters = {
      ...normalizedFilters,
      productType: undefined,
    }

    const broadenedSearch = await runStructuredSearch(broadenedFilters, safeLimit)
    if (broadenedSearch.total > 0) {
      const results = await enrichResults(
        broadenedSearch.products,
        broadenedFilters,
        'diagnostic_broadened',
        `Coincide con la institución/tema consultado, pero no como ${normalizedFilters.productType}.`,
      )

      return {
        filters: {
          search: input.search,
          title: input.title,
          author: input.author,
          institution: input.institution,
          keyword: input.keyword,
          productType: input.productType,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          yearFrom: input.yearFrom,
          yearTo: input.yearTo,
          limit: safeLimit,
        },
        normalizedFilters: {
          ...normalizedFilters,
          limit: safeLimit,
        },
        total: broadenedSearch.total,
        limitedTo: safeLimit,
        strategyUsed: 'diagnostic_broadened',
        matchedFields: uniqueStrings(results.flatMap((result) => result.matchedFields)),
        evidenceSnippets: results.flatMap((result) => result.evidenceSnippets).slice(0, 6),
        toolCallKey,
        diagnosticInfo,
        results,
      }
    }
  }

  const ocrSearch = await runOcrFullTextSearch(normalizedFilters, input.question, safeLimit)
  const ocrBroadened = ocrSearch.droppedFilters.length > 0 || ocrSearch.products.length > 0
  diagnosticInfo.broadened = diagnosticInfo.broadened || ocrBroadened
  diagnosticInfo.droppedFilters.push(...ocrSearch.droppedFilters)
  diagnosticInfo.notes.push(...ocrSearch.notes)

  if (ocrSearch.products.length > 0) {
    const results = await enrichResults(
      ocrSearch.products,
      normalizedFilters,
      'ocr_full_text',
      normalizedFilters.productType
        ? `Este resultado apareció al buscar también dentro del texto del archivo; puede no ser exactamente una ${formatChatProductType(normalizedFilters.productType).toLowerCase()}.`
        : undefined,
    )

    return {
      filters: {
        search: input.search,
        title: input.title,
        author: input.author,
        institution: input.institution,
        keyword: input.keyword,
        productType: input.productType,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        yearFrom: input.yearFrom,
        yearTo: input.yearTo,
        limit: safeLimit,
      },
      normalizedFilters: {
        ...normalizedFilters,
        limit: safeLimit,
      },
      total: results.length,
      limitedTo: safeLimit,
      strategyUsed: 'ocr_full_text',
      matchedFields: uniqueStrings(results.flatMap((result) => result.matchedFields)),
      evidenceSnippets: results.flatMap((result) => result.evidenceSnippets).slice(0, 6),
      toolCallKey,
      diagnosticInfo,
      results,
    }
  }

  return {
    filters: {
      search: input.search,
      title: input.title,
      author: input.author,
      institution: input.institution,
      keyword: input.keyword,
      productType: input.productType,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      yearFrom: input.yearFrom,
      yearTo: input.yearTo,
      limit: safeLimit,
    },
    normalizedFilters: {
      ...normalizedFilters,
      limit: safeLimit,
    },
    total: 0,
    limitedTo: safeLimit,
    strategyUsed: diagnosticInfo.broadened ? 'diagnostic_broadened' : 'structured_exact',
    matchedFields: [],
    evidenceSnippets: [],
    toolCallKey,
    diagnosticInfo,
    results: [],
  }
}
