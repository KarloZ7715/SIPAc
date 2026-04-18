import AcademicProduct from '~~/server/models/AcademicProduct'
import { PAGINATION, PRODUCT_TYPES, type ProductType } from '~~/app/types'

export type RepositoryCatalogSortBy = 'date_desc' | 'date_asc' | 'title_asc' | 'title_desc'

export interface ConfirmedRepositorySearchFilters {
  productType?: ProductType
  owner?: string
  institution?: string
  search?: string
  title?: string
  author?: string
  keyword?: string
  dateFrom?: string
  dateTo?: string
  year?: string
  yearFrom?: number
  yearTo?: number
  program?: string
  faculty?: string
}

export interface ConfirmedRepositorySearchOptions {
  page?: number
  limit?: number
  sortBy?: RepositoryCatalogSortBy
}

export interface RepositoryFacetCount {
  value: string
  count: number
}

export interface RepositorySearchTelemetry {
  executionMs: number
  sortBy: RepositoryCatalogSortBy
  page: number
  limit: number
  resultCount: number
}

export const CONFIRMED_REPOSITORY_INSTITUTION_FIELDS = [
  'manualMetadata.institution',
  'extractedEntities.institution.value',
  'university',
  'degreeGrantor',
  'eventSponsor',
  'publisher',
  'reportInstitution',
  'reportSponsor',
  'issuingEntity',
  'institution',
  'bookPublisher',
  'chapterPublisher',
  'patentAssignee',
] as const

export const CONFIRMED_REPOSITORY_TITLE_FIELDS = [
  'manualMetadata.title',
  'extractedEntities.title.value',
  'journalName',
  'eventName',
  'proceedingsTitle',
  'chapterBookTitle',
  'relatedEvent',
  'programOrCall',
  'reportNumber',
  'patentClassification',
] as const

export const CONFIRMED_REPOSITORY_AUTHOR_FIELDS = [
  'manualMetadata.authors',
  'extractedEntities.authors.value',
  'director',
  'jurors',
  'principalInvestigatorName',
  'coResearchers',
  'chapterEditors',
  'patentInventors',
  'patentAssignee',
] as const

export const CONFIRMED_REPOSITORY_KEYWORD_FIELDS = [
  'manualMetadata.keywords',
  'extractedEntities.keywords.value',
  'areaOfKnowledge',
  'reportAreaOfKnowledge',
  'keywords',
  'extractedEntities.eventOrJournal.value',
  'journalName',
  'eventName',
  'proceedingsTitle',
  'programOrCall',
  'relatedEvent',
  'softwareProgrammingLanguage',
  'softwarePlatform',
  'patentClassification',
] as const

export const CONFIRMED_REPOSITORY_PROGRAM_FIELDS = ['program', 'programOrCall'] as const
export const CONFIRMED_REPOSITORY_FACULTY_FIELDS = ['faculty'] as const

export const CONFIRMED_REPOSITORY_GENERIC_SEARCH_FIELDS = [
  ...CONFIRMED_REPOSITORY_TITLE_FIELDS,
  ...CONFIRMED_REPOSITORY_AUTHOR_FIELDS,
  ...CONFIRMED_REPOSITORY_KEYWORD_FIELDS,
  ...CONFIRMED_REPOSITORY_INSTITUTION_FIELDS,
  'manualMetadata.notes',
  'degreeName',
  'faculty',
  'program',
  'conferenceAcronym',
  'journalAbbreviation',
  'bookCollection',
  'reportRevision',
  'softwareLicense',
  'softwareType',
  'patentOffice',
  'patentCountry',
] as const

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeTextFilter(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function normalizeConfirmedRepositoryFilters(
  filters: ConfirmedRepositorySearchFilters,
): ConfirmedRepositorySearchFilters {
  return {
    productType: filters.productType,
    owner: normalizeTextFilter(filters.owner),
    institution: normalizeTextFilter(filters.institution),
    search: normalizeTextFilter(filters.search),
    title: normalizeTextFilter(filters.title),
    author: normalizeTextFilter(filters.author),
    keyword: normalizeTextFilter(filters.keyword),
    dateFrom: normalizeTextFilter(filters.dateFrom),
    dateTo: normalizeTextFilter(filters.dateTo),
    year: normalizeTextFilter(filters.year),
    yearFrom: typeof filters.yearFrom === 'number' ? filters.yearFrom : undefined,
    yearTo: typeof filters.yearTo === 'number' ? filters.yearTo : undefined,
    program: normalizeTextFilter(filters.program),
    faculty: normalizeTextFilter(filters.faculty),
  }
}

function buildRegexOrCondition(paths: readonly string[], searchValue: string) {
  const escaped = escapeRegex(searchValue)

  return {
    $or: paths.map((path) => ({
      [path]: { $regex: escaped, $options: 'i' },
    })),
  }
}

function buildRegexConditions(filters: ConfirmedRepositorySearchFilters) {
  const conditions: Record<string, unknown>[] = []

  const institution = normalizeTextFilter(filters.institution)
  if (institution) {
    conditions.push(buildRegexOrCondition(CONFIRMED_REPOSITORY_INSTITUTION_FIELDS, institution))
  }

  const title = normalizeTextFilter(filters.title)
  if (title) {
    conditions.push(buildRegexOrCondition(CONFIRMED_REPOSITORY_TITLE_FIELDS, title))
  }

  const author = normalizeTextFilter(filters.author)
  if (author) {
    conditions.push(buildRegexOrCondition(CONFIRMED_REPOSITORY_AUTHOR_FIELDS, author))
  }

  const keyword = normalizeTextFilter(filters.keyword)
  if (keyword) {
    conditions.push(buildRegexOrCondition(CONFIRMED_REPOSITORY_KEYWORD_FIELDS, keyword))
  }

  const program = normalizeTextFilter(filters.program)
  if (program) {
    conditions.push(buildRegexOrCondition(CONFIRMED_REPOSITORY_PROGRAM_FIELDS, program))
  }

  const faculty = normalizeTextFilter(filters.faculty)
  if (faculty) {
    conditions.push(buildRegexOrCondition(CONFIRMED_REPOSITORY_FACULTY_FIELDS, faculty))
  }

  const search = normalizeTextFilter(filters.search)
  if (search && (!filters.title || !filters.title.trim())) {
    conditions.push(buildRegexOrCondition(CONFIRMED_REPOSITORY_GENERIC_SEARCH_FIELDS, search))
  }

  return conditions
}

function buildEffectiveDateConditions(filters: ConfirmedRepositorySearchFilters) {
  const dateConditions: Record<string, unknown>[] = []
  const year = normalizeTextFilter(filters.year)

  if (year) {
    const yearNum = Number(year)
    if (!Number.isNaN(yearNum) && yearNum > 1900 && yearNum <= new Date().getFullYear() + 1) {
      dateConditions.push({
        $gte: [
          { $ifNull: ['$manualMetadata.date', '$extractedEntities.date.value'] },
          new Date(Date.UTC(yearNum, 0, 1)),
        ],
      })
      dateConditions.push({
        $lt: [
          { $ifNull: ['$manualMetadata.date', '$extractedEntities.date.value'] },
          new Date(Date.UTC(yearNum + 1, 0, 1)),
        ],
      })
    }
  }

  if (typeof filters.yearFrom === 'number' && filters.yearFrom > 1900) {
    dateConditions.push({
      $gte: [
        { $ifNull: ['$manualMetadata.date', '$extractedEntities.date.value'] },
        new Date(Date.UTC(filters.yearFrom, 0, 1)),
      ],
    })
  }

  if (typeof filters.yearTo === 'number' && filters.yearTo > 1900) {
    dateConditions.push({
      $lte: [
        { $ifNull: ['$manualMetadata.date', '$extractedEntities.date.value'] },
        new Date(Date.UTC(filters.yearTo, 11, 31, 23, 59, 59, 999)),
      ],
    })
  }

  const dateFrom = normalizeTextFilter(filters.dateFrom)
  if (dateFrom) {
    const parsed = new Date(dateFrom)
    if (!Number.isNaN(parsed.getTime())) {
      dateConditions.push({
        $gte: [{ $ifNull: ['$manualMetadata.date', '$extractedEntities.date.value'] }, parsed],
      })
    }
  }

  const dateTo = normalizeTextFilter(filters.dateTo)
  if (dateTo) {
    const parsed = new Date(dateTo)
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setUTCHours(23, 59, 59, 999)
      dateConditions.push({
        $lte: [{ $ifNull: ['$manualMetadata.date', '$extractedEntities.date.value'] }, parsed],
      })
    }
  }

  if (dateConditions.length === 0) {
    return undefined
  }

  return { $expr: { $and: dateConditions } }
}

/** Construye el filtro Mongo para el catálogo. Siempre restringe a productos confirmados. */
export function buildConfirmedRepositoryFilter(filters: ConfirmedRepositorySearchFilters) {
  const normalizedFilters = normalizeConfirmedRepositoryFilters(filters)
  const baseFilter: Record<string, unknown> = {
    isDeleted: false,
    reviewStatus: 'confirmed',
  }

  if (normalizedFilters.productType && PRODUCT_TYPES.includes(normalizedFilters.productType)) {
    baseFilter.productType = normalizedFilters.productType
  }

  const owner = normalizeTextFilter(normalizedFilters.owner)
  if (owner) {
    baseFilter.owner = owner
  }

  const dateFilter = buildEffectiveDateConditions(normalizedFilters)
  const regexConditions = buildRegexConditions(normalizedFilters)

  if (dateFilter || regexConditions.length > 0) {
    baseFilter.$and = [dateFilter, ...regexConditions].filter(Boolean)
  }

  return baseFilter
}

/**
 * Orden con criterio secundario estable: cuando se ordena por fecha,
 * los empates se rompen por título (A→Z) y por `createdAt` (desc) para
 * obtener orden determinístico aun cuando hay fechas iguales o nulas.
 */
function buildSortOptions(sortBy: RepositoryCatalogSortBy): Record<string, 1 | -1> {
  switch (sortBy) {
    case 'date_asc':
      return {
        'manualMetadata.date': 1,
        'manualMetadata.title': 1,
        createdAt: 1,
      }
    case 'title_asc':
      return {
        'manualMetadata.title': 1,
        'manualMetadata.date': -1,
        createdAt: -1,
      }
    case 'title_desc':
      return {
        'manualMetadata.title': -1,
        'manualMetadata.date': -1,
        createdAt: -1,
      }
    default:
      return {
        'manualMetadata.date': -1,
        'manualMetadata.title': 1,
        createdAt: -1,
      }
  }
}

function resolveSortBy(sortBy: RepositoryCatalogSortBy | undefined): RepositoryCatalogSortBy {
  if (
    sortBy === 'date_asc' ||
    sortBy === 'date_desc' ||
    sortBy === 'title_asc' ||
    sortBy === 'title_desc'
  ) {
    return sortBy
  }
  return 'date_desc'
}

export async function searchConfirmedRepositoryProducts(
  filters: ConfirmedRepositorySearchFilters,
  options: ConfirmedRepositorySearchOptions = {},
) {
  const startedAt = Date.now()
  const page = Math.max(1, Number(options.page) || 1)
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(PAGINATION.MIN_LIMIT, Number(options.limit) || PAGINATION.DEFAULT_LIMIT),
  )
  const sortBy = resolveSortBy(options.sortBy)
  const skip = (page - 1) * limit
  const filter = buildConfirmedRepositoryFilter(filters)
  const sortOptions = buildSortOptions(sortBy)

  const [products, total, productTypeFacets] = await Promise.all([
    AcademicProduct.find(filter).sort(sortOptions).skip(skip).limit(limit).lean(),
    AcademicProduct.countDocuments(filter),
    AcademicProduct.aggregate<{ _id: string; count: number }>([
      { $match: filter },
      { $group: { _id: '$productType', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 20 },
    ]),
  ])

  const facets = {
    productTypes: productTypeFacets.map((item) => ({ value: item._id, count: item.count })),
  }

  return {
    products,
    total,
    page,
    limit,
    hasMore: skip + products.length < total,
    facets,
    telemetry: {
      executionMs: Date.now() - startedAt,
      sortBy,
      page,
      limit,
      resultCount: products.length,
    },
  }
}
