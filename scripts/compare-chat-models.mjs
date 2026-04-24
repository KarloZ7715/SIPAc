import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import mongoose from 'mongoose'
import { SignJWT } from 'jose'

const CHAT_MODEL_PROVIDERS = ['cerebras', 'gemini', 'groq', 'openrouter', 'nvidia']
const DEFAULT_BASE_URL = process.env.CHAT_COMPARE_BASE_URL ?? 'http://127.0.0.1:3000'
const DEFAULT_MAX_MODELS = 0
const DEFAULT_SCENARIO_COUNT = 24
const DEFAULT_IGNORE_PROVIDER_ERRORS = ''
const DEFAULT_USER_COUNT = 1
const DEFAULT_MAX_REQUESTS_PER_USER = 28
const DEFAULT_REQUEST_TIMEOUT_MS = 45_000
const DEFAULT_MAX_STREAM_BYTES = 5_000_000
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_BASE_MS = 5_000
const DEFAULT_RETRY_MAX_MS = 120_000
const DEFAULT_MAX_CORPUS_PRODUCTS = 0
const SESSION_DURATION_HOURS = 8
const CHAT_TOOL_LIMIT = 8
const MAX_STORED_ASSISTANT_TEXT_CHARS = 2_000

const PRODUCT_TYPE_LABEL = {
  article: 'articulos',
  conference_paper: 'ponencias',
  thesis: 'tesis',
  certificate: 'certificados',
  research_project: 'proyectos de investigacion',
  book: 'libros',
  book_chapter: 'capitulos de libro',
  technical_report: 'informes tecnicos',
  software: 'software',
  patent: 'patentes',
}

function parseArgs(argv) {
  const args = {
    runId: '',
    baseUrl: DEFAULT_BASE_URL,
    maxModels: DEFAULT_MAX_MODELS,
    scenarioCount: DEFAULT_SCENARIO_COUNT,
    userIndex: 1,
    userCount: DEFAULT_USER_COUNT,
    maxRequestsPerUser: DEFAULT_MAX_REQUESTS_PER_USER,
    modelsRaw: '',
    ignoreProviderErrorsRaw: DEFAULT_IGNORE_PROVIDER_ERRORS,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    maxStreamBytes: DEFAULT_MAX_STREAM_BYTES,
    maxRetries: DEFAULT_MAX_RETRIES,
    retryBaseMs: DEFAULT_RETRY_BASE_MS,
    retryMaxMs: DEFAULT_RETRY_MAX_MS,
    maxCorpusProducts: DEFAULT_MAX_CORPUS_PRODUCTS,
    outputPath: '',
    resetRateLimitBuckets: false,
  }

  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      args.help = true
      continue
    }

    if (arg.startsWith('--run-id=')) {
      args.runId = arg.slice('--run-id='.length).trim()
      continue
    }

    if (arg.startsWith('--base-url=')) {
      args.baseUrl = arg.slice('--base-url='.length).trim()
      continue
    }

    if (arg.startsWith('--max-models=')) {
      args.maxModels = Number.parseInt(arg.slice('--max-models='.length), 10)
      continue
    }

    if (arg.startsWith('--scenario-count=')) {
      args.scenarioCount = Number.parseInt(arg.slice('--scenario-count='.length), 10)
      continue
    }

    if (arg.startsWith('--user-index=')) {
      args.userIndex = Number.parseInt(arg.slice('--user-index='.length), 10)
      continue
    }

    if (arg.startsWith('--user-count=')) {
      args.userCount = Number.parseInt(arg.slice('--user-count='.length), 10)
      continue
    }

    if (arg.startsWith('--max-requests-per-user=')) {
      args.maxRequestsPerUser = Number.parseInt(arg.slice('--max-requests-per-user='.length), 10)
      continue
    }

    if (arg.startsWith('--models=')) {
      args.modelsRaw = arg.slice('--models='.length).trim()
      continue
    }

    if (arg.startsWith('--ignore-provider-errors=')) {
      args.ignoreProviderErrorsRaw = arg.slice('--ignore-provider-errors='.length).trim()
      continue
    }

    if (arg.startsWith('--request-timeout-ms=')) {
      args.requestTimeoutMs = Number.parseInt(arg.slice('--request-timeout-ms='.length), 10)
      continue
    }

    if (arg.startsWith('--max-stream-bytes=')) {
      args.maxStreamBytes = Number.parseInt(arg.slice('--max-stream-bytes='.length), 10)
      continue
    }

    if (arg.startsWith('--max-retries=')) {
      args.maxRetries = Number.parseInt(arg.slice('--max-retries='.length), 10)
      continue
    }

    if (arg.startsWith('--retry-base-ms=')) {
      args.retryBaseMs = Number.parseInt(arg.slice('--retry-base-ms='.length), 10)
      continue
    }

    if (arg.startsWith('--retry-max-ms=')) {
      args.retryMaxMs = Number.parseInt(arg.slice('--retry-max-ms='.length), 10)
      continue
    }

    if (arg.startsWith('--max-corpus-products=')) {
      args.maxCorpusProducts = Number.parseInt(arg.slice('--max-corpus-products='.length), 10)
      continue
    }

    if (arg.startsWith('--output=')) {
      args.outputPath = arg.slice('--output='.length).trim()
      continue
    }

    if (arg === '--reset-rate-limit-buckets') {
      args.resetRateLimitBuckets = true
      continue
    }

    throw new Error(`Argumento no reconocido: ${arg}`)
  }

  return args
}

function printHelp() {
  console.info('Uso: node scripts/compare-chat-models.mjs --run-id=<id> [opciones]')
  console.info('')
  console.info('Opciones:')
  console.info(`  --base-url=<url>                Base URL app (default: ${DEFAULT_BASE_URL})`)
  console.info(
    `  --max-models=<n>                Limite de modelos manuales si no usas --models (0 = todos, default: ${DEFAULT_MAX_MODELS})`,
  )
  console.info(
    `  --scenario-count=<n>            Numero de escenarios a ejecutar por modelo (default: ${DEFAULT_SCENARIO_COUNT})`,
  )
  console.info('  --user-index=<n>                Usuario seed a usar: u01, u02... (default: 1)')
  console.info(
    `  --user-count=<n>                Cantidad de usuarios seed consecutivos para rotar carga (default: ${DEFAULT_USER_COUNT})`,
  )
  console.info(
    `  --max-requests-per-user=<n>     Tope preventivo por usuario durante la corrida (default: ${DEFAULT_MAX_REQUESTS_PER_USER})`,
  )
  console.info('  --models=<csv>                  Lista fija provider:modelId separada por coma')
  console.info(
    `  --ignore-provider-errors=<csv>  Proveedores cuyos http-error se ignoran para scoring (default: ${DEFAULT_IGNORE_PROVIDER_ERRORS})`,
  )
  console.info(
    `  --request-timeout-ms=<n>        Timeout por solicitud HTTP en ms (default: ${DEFAULT_REQUEST_TIMEOUT_MS})`,
  )
  console.info(
    `  --max-stream-bytes=<n>          Limite duro de bytes por stream de respuesta (default: ${DEFAULT_MAX_STREAM_BYTES})`,
  )
  console.info(
    `  --max-retries=<n>               Reintentos por escenario ante 429/503/504 o timeout/network (default: ${DEFAULT_MAX_RETRIES})`,
  )
  console.info(
    `  --retry-base-ms=<n>             Base de backoff exponencial para reintentos (default: ${DEFAULT_RETRY_BASE_MS})`,
  )
  console.info(
    `  --retry-max-ms=<n>              Maximo de backoff para reintentos (default: ${DEFAULT_RETRY_MAX_MS})`,
  )
  console.info(
    `  --max-corpus-products=<n>       Limite de productos confirmados usados para construir escenarios (0 = todos, default: ${DEFAULT_MAX_CORPUS_PRODUCTS})`,
  )
  console.info(
    '  --reset-rate-limit-buckets      Limpia buckets de rate-limit de los usuarios seed',
  )
  console.info('  --output=<path>                 Ruta del reporte JSON')
  console.info('  --help                          Muestra esta ayuda')
  console.info('')
  console.info('Variables requeridas: MONGODB_URI, JWT_SECRET')
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} debe ser un entero positivo`)
  }
}

function assertNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} debe ser un entero mayor o igual a cero`)
  }
}

function readEnvValue(name) {
  const direct = process.env[name]
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim()
  }

  if (!existsSync('.env')) {
    return ''
  }

  const envFile = readFileSync('.env', 'utf8')
  const line = envFile.split(/\r?\n/).find((candidate) => candidate.startsWith(`${name}=`))
  return line ? line.slice(name.length + 1).trim() : ''
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesNormalized(haystack, needle) {
  return normalizeText(haystack).includes(normalizeText(needle))
}

function startsWithNormalized(haystack, needle) {
  return normalizeText(haystack).startsWith(normalizeText(needle))
}

function firstWords(value, count = 6) {
  return String(value).split(/\s+/).slice(0, count).join(' ')
}

function uniqueStrings(values) {
  const seen = new Set()
  const items = []

  for (const value of values) {
    const clean = String(value ?? '').trim()
    if (!clean) {
      continue
    }

    const key = normalizeText(clean)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    items.push(clean)
  }

  return items
}

function parseYearFromAny(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const year = Math.trunc(value)
    if (year >= 1900 && year <= 2100) {
      return year
    }
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const year = value.getUTCFullYear()
    if (year >= 1900 && year <= 2100) {
      return year
    }
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim()
    const direct = Number.parseInt(trimmed, 10)
    if (Number.isFinite(direct) && direct >= 1900 && direct <= 2100) {
      return direct
    }

    const match = trimmed.match(/(19|20)\d{2}/)
    if (match) {
      return Number.parseInt(match[0], 10)
    }
  }

  return null
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) {
    return null
  }

  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  const index = Math.min(Math.max(rank, 0), sorted.length - 1)
  return sorted[index]
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0
  }

  return values.reduce((acc, value) => acc + value, 0) / values.length
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

function parseModelsCsv(raw) {
  if (!raw) {
    return []
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separator = item.indexOf(':')
      if (separator <= 0) {
        throw new Error(`Modelo invalido en --models: ${item}. Usa provider:modelId`)
      }

      const provider = item.slice(0, separator)
      const modelId = item.slice(separator + 1)

      if (!CHAT_MODEL_PROVIDERS.includes(provider)) {
        throw new Error(`Proveedor no soportado en --models: ${provider}`)
      }

      if (!modelId) {
        throw new Error(`Model ID vacio en --models: ${item}`)
      }

      return { provider, modelId }
    })
}

function parseProvidersCsv(raw) {
  if (!raw) {
    return new Set()
  }

  const providers = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  for (const provider of providers) {
    if (!CHAT_MODEL_PROVIDERS.includes(provider)) {
      throw new Error(`Proveedor no soportado en --ignore-provider-errors: ${provider}`)
    }
  }

  return new Set(providers)
}

function normalizeDiscoveredModels(rawItems) {
  const normalized = []

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const provider = String(item.provider ?? '').trim()
    const modelId = String(item.modelId ?? '').trim()

    if (!provider || !modelId) {
      continue
    }

    if (!CHAT_MODEL_PROVIDERS.includes(provider)) {
      continue
    }

    normalized.push({ provider, modelId })
  }

  return normalized
}

function extractMessageText(message) {
  if (!message || !Array.isArray(message.parts)) {
    return ''
  }

  const chunks = []

  for (const part of message.parts) {
    if (!part || typeof part !== 'object') {
      continue
    }

    if (typeof part.text === 'string' && part.text.trim().length > 0) {
      chunks.push(part.text.trim())
      continue
    }

    if (typeof part.content === 'string' && part.content.trim().length > 0) {
      chunks.push(part.content.trim())
      continue
    }
  }

  return chunks.join(' ').trim()
}

function extractToolOutputs(messages) {
  const outputs = []

  for (const message of messages) {
    if (!Array.isArray(message.parts)) {
      continue
    }

    for (const part of message.parts) {
      if (!part || part.type !== 'tool-searchRepositoryProducts' || !part.output) {
        continue
      }

      outputs.push(part.output)
    }
  }

  return outputs
}

function inspectToolOutputs(toolOutputs) {
  const productMap = new Map()
  const strategies = new Set()
  const outputsCompact = []
  let maxToolTotal = 0

  for (const output of toolOutputs) {
    const total =
      typeof output?.total === 'number' && Number.isFinite(output.total) ? output.total : 0
    maxToolTotal = Math.max(maxToolTotal, total)

    if (typeof output?.strategyUsed === 'string' && output.strategyUsed.trim().length > 0) {
      strategies.add(output.strategyUsed)
    }

    const resultRows = Array.isArray(output?.results) ? output.results : []
    const compactRows = []

    for (const row of resultRows) {
      const productId = String(row?.productId ?? '').trim()
      if (!productId) {
        continue
      }

      const title = String(row?.title ?? '').trim()
      const year = parseYearFromAny(row?.year ?? row?.referenceDate)
      const productType = String(row?.productType ?? '').trim()

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          productId,
          title,
          year,
          productType,
        })
      }

      compactRows.push({
        productId,
        title,
        year,
        productType,
      })
    }

    outputsCompact.push({
      total,
      strategyUsed: output?.strategyUsed ?? null,
      normalizedFilters: output?.normalizedFilters ?? null,
      resultCount: compactRows.length,
      results: compactRows,
    })
  }

  return {
    maxToolTotal,
    strategies: [...strategies],
    returnedProducts: [...productMap.values()],
    compactOutputs: outputsCompact,
  }
}

function compactScenarioCounts(total) {
  if (total === 1) {
    return {
      exactTitle: 0,
      authorYearType: 0,
      institutionYearType: 0,
      keywordType: 0,
      noResults: 1,
    }
  }

  const weights = {
    exactTitle: 0.18,
    authorYearType: 0.34,
    institutionYearType: 0.24,
    keywordType: 0.16,
    noResults: 0.08,
  }

  const plan = {
    exactTitle: 0,
    authorYearType: 1,
    institutionYearType: 0,
    keywordType: 0,
    noResults: 1,
  }

  let assigned = 2
  const keys = ['exactTitle', 'authorYearType', 'institutionYearType', 'keywordType', 'noResults']

  while (assigned < total) {
    let bestKey = keys[0]
    let bestDeficit = -Infinity

    for (const key of keys) {
      const desired = weights[key] * total
      const deficit = desired - plan[key]
      if (deficit > bestDeficit) {
        bestDeficit = deficit
        bestKey = key
      }
    }

    plan[bestKey] += 1
    assigned += 1
  }

  return plan
}

function normalizeCorpusProduct(raw) {
  const manual = raw?.manualMetadata ?? {}
  const title = String(manual.title ?? '').trim()
  if (!title) {
    return null
  }

  const authors = uniqueStrings(Array.isArray(manual.authors) ? manual.authors : [])
  const keywords = uniqueStrings(Array.isArray(manual.keywords) ? manual.keywords : [])
  const institution = String(manual.institution ?? '').trim()

  const year =
    parseYearFromAny(raw?.referenceDate) ??
    parseYearFromAny(manual?.date) ??
    parseYearFromAny(manual?.year)

  if (!year) {
    return null
  }

  const productType = String(raw?.productType ?? '').trim()
  if (!productType) {
    return null
  }

  return {
    productId: String(raw._id),
    title,
    authors,
    keywords,
    institution,
    year,
    productType,
  }
}

function buildExactTitleQuestion(title, idx) {
  const templates = [
    `Dime que informacion tienes sobre el trabajo titulado "${title}".`,
    `Ubica el documento llamado "${title}" y resumelo brevemente.`,
    `Necesito verificar si existe este trabajo: "${title}".`,
  ]
  return templates[idx % templates.length]
}

function buildAuthorYearTypeQuestion(author, year, productType, idx) {
  const label = PRODUCT_TYPE_LABEL[productType] ?? 'documentos'
  const templates = [
    `Dime las ${label} del profesor ${author} en el anio ${year}.`,
    `Que ${label} confirmadas de ${author} registradas en ${year} hay en SIPAc?`,
    `Necesito listar ${label} de ${author} del ${year}.`,
  ]
  return templates[idx % templates.length]
}

function buildInstitutionYearTypeQuestion(institution, year, productType, idx) {
  const label = PRODUCT_TYPE_LABEL[productType] ?? 'documentos'
  const templates = [
    `Muestrame ${label} de ${institution} para el anio ${year}.`,
    `Que ${label} confirmadas tiene ${institution} en ${year}?`,
    `Busco ${label} publicadas por ${institution} durante ${year}.`,
  ]
  return templates[idx % templates.length]
}

function buildKeywordTypeQuestion(keyword, productType, idx) {
  const label = PRODUCT_TYPE_LABEL[productType] ?? 'documentos'
  const templates = [
    `Que ${label} confirmados hay sobre ${keyword}?`,
    `Necesito ${label} relacionadas con ${keyword}.`,
    `Lista ${label} del repositorio que traten ${keyword}.`,
  ]
  return templates[idx % templates.length]
}

function buildNoResultsQuestion(token, idx) {
  const templates = [
    `Que tesis del profesor ${token} registradas en 2025 existen?`,
    `Muestrame articulos del autor ${token} con evidencia confirmada.`,
    `Busca documentos academicos sobre ${token} y dime si hay coincidencias.`,
  ]
  return templates[idx % templates.length]
}

function summarizeCorpus(corpus) {
  const byType = {}
  const byYear = {}
  const byInstitution = {}

  for (const item of corpus) {
    byType[item.productType] = (byType[item.productType] ?? 0) + 1
    byYear[item.year] = (byYear[item.year] ?? 0) + 1

    if (item.institution) {
      byInstitution[item.institution] = (byInstitution[item.institution] ?? 0) + 1
    }
  }

  const topInstitutions = Object.entries(byInstitution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([institution, total]) => ({ institution, total }))

  return {
    totalProducts: corpus.length,
    byType,
    byYear,
    topInstitutions,
  }
}

function buildScenarios(corpus, runId, scenarioCount) {
  const counts = compactScenarioCounts(scenarioCount)
  const exactTitlePool = []
  const authorYearTypePool = []
  const institutionYearTypePool = []
  const keywordTypePool = []
  const noResultsPool = []

  const uniqueTitleProducts = corpus.filter(
    (item, index, list) =>
      list.findIndex(
        (candidate) => normalizeText(candidate.title) === normalizeText(item.title),
      ) === index,
  )

  uniqueTitleProducts.sort((a, b) => a.title.localeCompare(b.title))
  for (const item of uniqueTitleProducts) {
    exactTitlePool.push({
      category: 'exact-title',
      expectedProductIds: [item.productId],
      expectedSignals: uniqueStrings([
        firstWords(item.title, 7),
        item.authors[0],
        item.institution,
      ]),
      questionSeed: {
        title: item.title,
      },
      expectedCount: 1,
      expectNoResults: false,
    })
  }

  const authorYearTypeGroups = new Map()
  const institutionYearTypeGroups = new Map()
  const keywordTypeGroups = new Map()

  for (const item of corpus) {
    const primaryAuthor = item.authors[0]
    if (primaryAuthor) {
      const authorKey = `${normalizeText(primaryAuthor)}::${item.year}::${item.productType}`
      if (!authorYearTypeGroups.has(authorKey)) {
        authorYearTypeGroups.set(authorKey, {
          author: primaryAuthor,
          year: item.year,
          productType: item.productType,
          productIds: [],
        })
      }
      authorYearTypeGroups.get(authorKey).productIds.push(item.productId)
    }

    if (item.institution) {
      const institutionKey = `${normalizeText(item.institution)}::${item.year}::${item.productType}`
      if (!institutionYearTypeGroups.has(institutionKey)) {
        institutionYearTypeGroups.set(institutionKey, {
          institution: item.institution,
          year: item.year,
          productType: item.productType,
          productIds: [],
        })
      }
      institutionYearTypeGroups.get(institutionKey).productIds.push(item.productId)
    }

    const keywordCandidates = item.keywords.slice(0, 3)
    for (const keyword of keywordCandidates) {
      if (normalizeText(keyword).length < 4) {
        continue
      }

      const keywordKey = `${normalizeText(keyword)}::${item.productType}`
      if (!keywordTypeGroups.has(keywordKey)) {
        keywordTypeGroups.set(keywordKey, {
          keyword,
          productType: item.productType,
          productIds: [],
        })
      }
      keywordTypeGroups.get(keywordKey).productIds.push(item.productId)
    }
  }

  const buildPoolFromGroups = (groups, mapper) => {
    return [...groups.values()]
      .map((group) => ({
        ...group,
        productIds: uniqueStrings(group.productIds).slice(0, CHAT_TOOL_LIMIT),
      }))
      .filter((group) => group.productIds.length > 0 && group.productIds.length <= CHAT_TOOL_LIMIT)
      .sort((a, b) => b.productIds.length - a.productIds.length)
      .map(mapper)
  }

  authorYearTypePool.push(
    ...buildPoolFromGroups(authorYearTypeGroups, (group) => ({
      category: 'author-year-type',
      expectedProductIds: group.productIds,
      expectedSignals: uniqueStrings([
        group.author,
        String(group.year),
        PRODUCT_TYPE_LABEL[group.productType] ?? group.productType,
      ]),
      questionSeed: {
        author: group.author,
        year: group.year,
        productType: group.productType,
      },
      expectedCount: group.productIds.length,
      expectNoResults: false,
    })),
  )

  institutionYearTypePool.push(
    ...buildPoolFromGroups(institutionYearTypeGroups, (group) => ({
      category: 'institution-year-type',
      expectedProductIds: group.productIds,
      expectedSignals: uniqueStrings([
        group.institution,
        String(group.year),
        PRODUCT_TYPE_LABEL[group.productType] ?? group.productType,
      ]),
      questionSeed: {
        institution: group.institution,
        year: group.year,
        productType: group.productType,
      },
      expectedCount: group.productIds.length,
      expectNoResults: false,
    })),
  )

  keywordTypePool.push(
    ...buildPoolFromGroups(keywordTypeGroups, (group) => ({
      category: 'keyword-type',
      expectedProductIds: group.productIds,
      expectedSignals: uniqueStrings([
        group.keyword,
        PRODUCT_TYPE_LABEL[group.productType] ?? group.productType,
      ]),
      questionSeed: {
        keyword: group.keyword,
        productType: group.productType,
      },
      expectedCount: group.productIds.length,
      expectNoResults: false,
    })),
  )

  for (let index = 0; index < Math.max(2, counts.noResults * 2); index += 1) {
    noResultsPool.push({
      category: 'no-results',
      expectedProductIds: [],
      expectedSignals: [],
      questionSeed: {
        token: `autor_inexistente_${runId}_${index + 1}`,
      },
      expectedCount: 0,
      expectNoResults: true,
    })
  }

  const selected = []
  const seenQuestion = new Set()
  let scenarioIdCounter = 1

  const materializeScenario = (candidate, idx) => {
    let question = ''

    if (candidate.category === 'exact-title') {
      question = buildExactTitleQuestion(candidate.questionSeed.title, idx)
    } else if (candidate.category === 'author-year-type') {
      question = buildAuthorYearTypeQuestion(
        candidate.questionSeed.author,
        candidate.questionSeed.year,
        candidate.questionSeed.productType,
        idx,
      )
    } else if (candidate.category === 'institution-year-type') {
      question = buildInstitutionYearTypeQuestion(
        candidate.questionSeed.institution,
        candidate.questionSeed.year,
        candidate.questionSeed.productType,
        idx,
      )
    } else if (candidate.category === 'keyword-type') {
      question = buildKeywordTypeQuestion(
        candidate.questionSeed.keyword,
        candidate.questionSeed.productType,
        idx,
      )
    } else {
      question = buildNoResultsQuestion(candidate.questionSeed.token, idx)
    }

    return {
      id: `${candidate.category}-${String(scenarioIdCounter++).padStart(3, '0')}`,
      category: candidate.category,
      question,
      expectedProductIds: candidate.expectedProductIds,
      expectedCount: candidate.expectedCount,
      expectedSignals: candidate.expectedSignals,
      expectNoResults: candidate.expectNoResults,
    }
  }

  const takeFromPool = (pool, desired) => {
    let index = 0
    while (selected.length < scenarioCount && desired > 0 && index < pool.length) {
      const candidate = pool[index]
      const scenario = materializeScenario(candidate, index)
      index += 1

      const questionKey = normalizeText(scenario.question)
      if (seenQuestion.has(questionKey)) {
        continue
      }

      seenQuestion.add(questionKey)
      selected.push(scenario)
      desired -= 1
    }
  }

  takeFromPool(exactTitlePool, counts.exactTitle)
  takeFromPool(authorYearTypePool, counts.authorYearType)
  takeFromPool(institutionYearTypePool, counts.institutionYearType)
  takeFromPool(keywordTypePool, counts.keywordType)
  takeFromPool(noResultsPool, counts.noResults)

  if (selected.length < scenarioCount) {
    const fallbackPool = [
      ...authorYearTypePool,
      ...institutionYearTypePool,
      ...keywordTypePool,
      ...exactTitlePool,
    ]
    takeFromPool(fallbackPool, scenarioCount - selected.length)
  }

  if (selected.length < Math.min(4, scenarioCount)) {
    throw new Error(
      'No se pudieron construir suficientes escenarios de benchmark con el corpus actual',
    )
  }

  return selected.slice(0, scenarioCount)
}

function calculateSetMetrics(expectedIds, returnedIds, expectNoResults) {
  const expectedSet = new Set(expectedIds)
  const returnedSet = new Set(returnedIds)

  if (expectNoResults) {
    const success = returnedSet.size === 0
    return {
      precision: success ? 1 : 0,
      recall: success ? 1 : 0,
      f1: success ? 1 : 0,
      truePositive: success ? 1 : 0,
      falsePositive: success ? 0 : returnedSet.size,
      falseNegative: success ? 0 : 1,
      missingProductIds: [],
      extraProductIds: [...returnedSet],
    }
  }

  const intersection = [...returnedSet].filter((id) => expectedSet.has(id))
  const truePositive = intersection.length
  const falsePositive = Math.max(0, returnedSet.size - truePositive)
  const falseNegative = Math.max(0, expectedSet.size - truePositive)
  const precision = returnedSet.size > 0 ? truePositive / returnedSet.size : 0
  const recall = expectedSet.size > 0 ? truePositive / expectedSet.size : 0
  const f1 =
    precision > 0 || recall > 0
      ? (2 * precision * recall) / Math.max(precision + recall, 0.0001)
      : 0

  return {
    precision,
    recall,
    f1,
    truePositive,
    falsePositive,
    falseNegative,
    missingProductIds: [...expectedSet].filter((id) => !returnedSet.has(id)),
    extraProductIds: [...returnedSet].filter((id) => !expectedSet.has(id)),
  }
}

function evaluateScenario(record) {
  const assistantText = record.assistantText ?? ''
  const assistantTextNormalized = normalizeText(assistantText)
  const assistantHasText = assistantTextNormalized.length > 0

  const inspection = inspectToolOutputs(record.toolOutputs)
  const returnedIds = inspection.returnedProducts.map((item) => item.productId)
  const expectedIds = record.scenario.expectedProductIds

  const setMetrics = calculateSetMetrics(expectedIds, returnedIds, record.scenario.expectNoResults)

  const retrievalScore = record.scenario.expectNoResults
    ? setMetrics.f1
    : clamp01(0.55 * setMetrics.precision + 0.45 * setMetrics.recall)

  const expectedSignalMatches = record.scenario.expectedSignals.filter((signal) =>
    includesNormalized(assistantText, signal),
  )

  const mentionsNoResults = /(no hay|sin resultados|no se encontraron|no encontre)/.test(
    assistantTextNormalized,
  )
  const claimsFound = /(encontre|te muestro|aqui estan|hay\s+\d+|identifique|se encontraron)/.test(
    assistantTextNormalized,
  )

  const returnedTitlePrefixes = inspection.returnedProducts
    .map((item) => firstWords(item.title, 5))
    .filter(Boolean)

  const referencesReturnedTitle =
    returnedTitlePrefixes.length > 0
      ? returnedTitlePrefixes.some((titlePrefix) => includesNormalized(assistantText, titlePrefix))
      : false

  let responseGroundingScore = 0
  if (assistantHasText) {
    if (record.scenario.expectNoResults) {
      if (mentionsNoResults && !claimsFound) {
        responseGroundingScore = 1
      } else if (!mentionsNoResults && !claimsFound) {
        responseGroundingScore = 0.2
      } else {
        responseGroundingScore = 0
      }
    } else {
      const expectedSignalCoverage =
        record.scenario.expectedSignals.length > 0
          ? expectedSignalMatches.length / record.scenario.expectedSignals.length
          : 1

      const titleGrounding = referencesReturnedTitle ? 1 : 0
      responseGroundingScore = clamp01(0.65 * expectedSignalCoverage + 0.35 * titleGrounding)
    }
  }

  const contradictsEvidence =
    (mentionsNoResults && inspection.returnedProducts.length > 0) ||
    (claimsFound && inspection.returnedProducts.length === 0)

  if (contradictsEvidence) {
    responseGroundingScore *= 0.2
  }

  const overallScore = clamp01(0.72 * retrievalScore + 0.28 * responseGroundingScore)

  const likelyLogicIssue =
    (record.scenario.expectNoResults && inspection.returnedProducts.length > 0) ||
    retrievalScore < 0.45

  const likelyModelIssue = retrievalScore >= 0.7 && responseGroundingScore < 0.45

  const likelyMixedIssue = retrievalScore < 0.45 && responseGroundingScore < 0.45

  let primaryIssue = 'none'
  if (likelyMixedIssue) {
    primaryIssue = 'mixed'
  } else if (likelyModelIssue) {
    primaryIssue = 'model'
  } else if (likelyLogicIssue) {
    primaryIssue = 'logic'
  }

  const fallbackToBroadMatch = inspection.strategies.some((strategy) =>
    startsWithNormalized(strategy, 'ocr_full_text'),
  )

  return {
    overallScore,
    retrievalScore,
    responseGroundingScore,
    precision: setMetrics.precision,
    recall: setMetrics.recall,
    f1: setMetrics.f1,
    expectedSignalMatches,
    mentionsNoResults,
    claimsFound,
    referencesReturnedTitle,
    contradictsEvidence,
    likelyLogicIssue,
    likelyModelIssue,
    likelyMixedIssue,
    primaryIssue,
    fallbackToBroadMatch,
    missingProductIds: setMetrics.missingProductIds,
    extraProductIds: setMetrics.extraProductIds,
    returnedProductIds: returnedIds,
    maxToolTotal: inspection.maxToolTotal,
    toolStrategies: inspection.strategies,
    assistantHasText,
    assistantTextLength: assistantText.length,
    compactToolOutputs: inspection.compactOutputs,
  }
}

function failureEvaluation(errorCode) {
  return {
    overallScore: 0,
    retrievalScore: 0,
    responseGroundingScore: 0,
    precision: 0,
    recall: 0,
    f1: 0,
    expectedSignalMatches: [],
    mentionsNoResults: false,
    claimsFound: false,
    referencesReturnedTitle: false,
    contradictsEvidence: false,
    likelyLogicIssue: false,
    likelyModelIssue: false,
    likelyMixedIssue: false,
    primaryIssue: 'transport',
    fallbackToBroadMatch: false,
    missingProductIds: [],
    extraProductIds: [],
    returnedProductIds: [],
    maxToolTotal: 0,
    toolStrategies: [],
    assistantHasText: false,
    assistantTextLength: 0,
    compactToolOutputs: [],
    errorCode,
  }
}

function compactScenarioForRecord(scenario) {
  return {
    id: scenario.id,
    category: scenario.category,
    question: scenario.question,
    expectNoResults: scenario.expectNoResults,
    expectedCount: scenario.expectedCount,
  }
}

function compactToolOutputsForRecord(outputs) {
  return (Array.isArray(outputs) ? outputs : []).map((output) => ({
    total: output.total,
    strategyUsed: output.strategyUsed,
    resultCount: output.resultCount,
  }))
}

function compactEvaluationForRecord(evaluation) {
  return {
    ...evaluation,
    compactToolOutputs: compactToolOutputsForRecord(evaluation.compactToolOutputs),
  }
}

function classifyTier(summary) {
  const primary = summary.primaryQualityScore
  const retrieval = summary.retrievalQualityScore
  const response = summary.responseQualityScore
  const reliability = summary.reliability.consideredSuccessRate

  if (primary >= 0.78 && retrieval >= 0.78 && response >= 0.6 && reliability >= 0.9) {
    return 'recommended'
  }

  if (primary >= 0.62 && retrieval >= 0.58 && reliability >= 0.75) {
    return 'usable'
  }

  if (primary >= 0.4 && retrieval >= 0.35) {
    return 'needs-review'
  }

  return 'unusable'
}

function isIgnoredFailureRecord(item, ignoredProviderSet) {
  return isIgnoredFailureStatus(item.status, item.model.provider, ignoredProviderSet)
}

function isIgnoredFailureStatus(status, provider, ignoredProviderSet) {
  return status !== 'ok' && ignoredProviderSet.has(provider) && status === 'http-error'
}

function aggregateByModel(records, ignoredProviderSet) {
  const byModel = new Map()

  for (const record of records) {
    const key = `${record.model.provider}::${record.model.modelId}`
    if (!byModel.has(key)) {
      byModel.set(key, [])
    }
    byModel.get(key).push(record)
  }

  const summary = []

  for (const [key, modelRecords] of byModel.entries()) {
    const ignoredFailures = modelRecords.filter((item) =>
      isIgnoredFailureRecord(item, ignoredProviderSet),
    )

    const consideredRecords = modelRecords.filter(
      (item) => !isIgnoredFailureRecord(item, ignoredProviderSet),
    )

    const consideredOk = consideredRecords.filter((item) => item.status === 'ok')

    const latencyValues = consideredOk.map((item) => item.latencyMs)
    const retrievalValues = consideredOk.map((item) => item.evaluation.retrievalScore)
    const responseValues = consideredOk.map((item) => item.evaluation.responseGroundingScore)
    const primaryValues = consideredOk.map((item) => item.evaluation.overallScore)
    const precisionValues = consideredOk.map((item) => item.evaluation.precision)
    const recallValues = consideredOk.map((item) => item.evaluation.recall)

    const reliabilityRate =
      consideredRecords.length > 0 ? consideredOk.length / consideredRecords.length : 0

    const p95 = percentile(latencyValues, 95)
    const latencyScore = p95 ? 1 / (1 + p95 / 4500) : 0

    const primaryQualityScore = average(primaryValues)
    const retrievalQualityScore = average(retrievalValues)
    const responseQualityScore = average(responseValues)

    const rankingScore = clamp01(
      0.85 * primaryQualityScore + 0.1 * reliabilityRate + 0.05 * latencyScore,
    )

    const issueBreakdown = {
      primaryIssue: {
        logic: consideredOk.filter((item) => item.evaluation.primaryIssue === 'logic').length,
        model: consideredOk.filter((item) => item.evaluation.primaryIssue === 'model').length,
        mixed: consideredOk.filter((item) => item.evaluation.primaryIssue === 'mixed').length,
        none: consideredOk.filter((item) => item.evaluation.primaryIssue === 'none').length,
      },
      tagged: {
        likelyLogicIssue: consideredOk.filter((item) => item.evaluation.likelyLogicIssue).length,
        likelyModelIssue: consideredOk.filter((item) => item.evaluation.likelyModelIssue).length,
        likelyMixedIssue: consideredOk.filter((item) => item.evaluation.likelyMixedIssue).length,
      },
      contradictions: consideredOk.filter((item) => item.evaluation.contradictsEvidence).length,
      emptyAssistantAnswer: consideredOk.filter((item) => !item.evaluation.assistantHasText).length,
    }

    const modelSummary = {
      modelKey: key,
      provider: modelRecords[0].model.provider,
      modelId: modelRecords[0].model.modelId,
      scenariosRequested: modelRecords.length,
      scenariosConsidered: consideredRecords.length,
      scenariosSucceeded: consideredOk.length,
      primaryQualityScore,
      retrievalQualityScore,
      responseQualityScore,
      precisionAverage: average(precisionValues),
      recallAverage: average(recallValues),
      reliability: {
        totalFailures: modelRecords.filter((item) => item.status !== 'ok').length,
        ignoredFailures: ignoredFailures.length,
        consideredFailures: consideredRecords.filter((item) => item.status !== 'ok').length,
        consideredSuccessRate: reliabilityRate,
      },
      latencyMs: {
        avg: average(latencyValues),
        p95,
      },
      issueBreakdown,
      rankingScore,
    }

    modelSummary.tier = classifyTier(modelSummary)
    summary.push(modelSummary)
  }

  return summary.sort((a, b) => b.rankingScore - a.rankingScore)
}

function buildGlobalSummary(records, summaryByModel, ignoredProviderSet) {
  const consideredRecords = records.filter(
    (item) => !isIgnoredFailureRecord(item, ignoredProviderSet),
  )
  const okRecords = consideredRecords.filter((item) => item.status === 'ok')

  const byTier = summaryByModel.reduce((acc, item) => {
    acc[item.tier] = (acc[item.tier] ?? 0) + 1
    return acc
  }, {})

  return {
    records: {
      total: records.length,
      considered: consideredRecords.length,
      succeeded: okRecords.length,
      failed: consideredRecords.filter((item) => item.status !== 'ok').length,
      ignoredFailures: records.filter((item) => isIgnoredFailureRecord(item, ignoredProviderSet))
        .length,
    },
    quality: {
      primaryAverage: average(okRecords.map((item) => item.evaluation.overallScore)),
      retrievalAverage: average(okRecords.map((item) => item.evaluation.retrievalScore)),
      responseAverage: average(okRecords.map((item) => item.evaluation.responseGroundingScore)),
      precisionAverage: average(okRecords.map((item) => item.evaluation.precision)),
      recallAverage: average(okRecords.map((item) => item.evaluation.recall)),
    },
    issueAttribution: {
      primaryIssue: {
        logic: okRecords.filter((item) => item.evaluation.primaryIssue === 'logic').length,
        model: okRecords.filter((item) => item.evaluation.primaryIssue === 'model').length,
        mixed: okRecords.filter((item) => item.evaluation.primaryIssue === 'mixed').length,
        none: okRecords.filter((item) => item.evaluation.primaryIssue === 'none').length,
      },
      contradictions: okRecords.filter((item) => item.evaluation.contradictsEvidence).length,
      emptyAssistantAnswer: okRecords.filter((item) => !item.evaluation.assistantHasText).length,
    },
    tierDistribution: byTier,
  }
}

function createTimeoutError(message) {
  const error = new Error(message)
  error.name = 'TimeoutError'
  return error
}

function isTimeoutLikeError(error) {
  return (
    isAbortError(error) || (error && typeof error === 'object' && error.name === 'TimeoutError')
  )
}

function isStreamByteLimitError(error) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    typeof error.message === 'string' &&
    /stream de chat excedio limite/i.test(error.message),
  )
}

function classifyTransportError(error) {
  if (isTimeoutLikeError(error)) {
    return 'timeout-error'
  }

  if (isStreamByteLimitError(error)) {
    return 'stream-byte-limit'
  }

  return 'network-error'
}

function isRetryableTransportStatus(status) {
  return status === 'timeout-error' || status === 'network-error'
}

async function readResponseTextWithTimeout(response, timeoutMs, label) {
  let timeoutHandle = null

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      if (response?.body && typeof response.body.cancel === 'function') {
        void response.body.cancel().catch(() => {})
      }
      reject(createTimeoutError(`${label} excedio ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([response.text(), timeoutPromise])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

async function consumeStreamBody(
  response,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_STREAM_BYTES,
) {
  if (!response?.body || typeof response.body.getReader !== 'function') {
    const body = await readResponseTextWithTimeout(response, timeoutMs, 'lectura de stream de chat')
    if (body.length > maxBytes) {
      throw new Error(`stream de chat excedio limite de ${maxBytes} bytes`)
    }
    return body.length
  }

  const reader = response.body.getReader()
  let totalBytes = 0
  let timedOut = false
  let timeoutHandle = null

  timeoutHandle = setTimeout(() => {
    timedOut = true
    void reader.cancel('stream-timeout').catch(() => {})
  }, timeoutMs)

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (timedOut) {
        throw createTimeoutError(`lectura de stream de chat excedio ${timeoutMs}ms`)
      }

      if (done) {
        break
      }

      totalBytes += value?.byteLength ?? 0
      if (totalBytes > maxBytes) {
        void reader.cancel('stream-byte-limit').catch(() => {})
        throw new Error(`stream de chat excedio limite de ${maxBytes} bytes`)
      }
    }

    return totalBytes
  } catch (error) {
    if (timedOut) {
      throw createTimeoutError(`lectura de stream de chat excedio ${timeoutMs}ms`)
    }
    throw error
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
    try {
      reader.releaseLock()
    } catch {
      // No-op
    }
  }
}

function isAbortError(error) {
  if (!error || typeof error !== 'object') {
    return false
  }

  if (error.name === 'AbortError') {
    return true
  }

  if (typeof error.message === 'string' && /aborted|timeout/i.test(error.message)) {
    return true
  }

  return false
}

function shouldRetryHttpStatus(status) {
  return status === 429 || status === 503 || status === 504
}

function parseRetryAfterMs(response) {
  const value = response?.headers?.get?.('retry-after')
  if (!value) {
    return null
  }

  const seconds = Number.parseInt(value, 10)
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000
  }

  const dateMs = Date.parse(value)
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now())
  }

  return null
}

function resolveRetryDelayMs(attempt, baseMs, maxMs, retryAfterMs = null) {
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(maxMs, Math.max(baseMs, retryAfterMs))
  }

  const exponent = Math.max(0, attempt - 1)
  const backoff = Math.min(maxMs, baseMs * 2 ** exponent)
  const jitter = Math.floor(Math.random() * Math.max(250, Math.min(1200, backoff * 0.2)))
  return Math.min(maxMs, backoff + jitter)
}

async function sleepMs(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return
  }

  await new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => {
    controller.abort('request-timeout')
  }, timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function requestJson(url, options = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const response = await fetchWithTimeout(url, options, timeoutMs)
  const bodyText = await readResponseTextWithTimeout(response, timeoutMs, 'lectura de cuerpo JSON')

  let parsed
  try {
    parsed = bodyText ? JSON.parse(bodyText) : null
  } catch {
    parsed = null
  }

  return {
    ok: response.ok,
    status: response.status,
    retryAfterMs: parseRetryAfterMs(response),
    bodyText,
    json: parsed,
  }
}

async function main() {
  const args = parseArgs(process.argv)

  if (args.help) {
    printHelp()
    return
  }

  if (!args.runId) {
    throw new Error('Debes indicar --run-id=<id>')
  }

  assertNonNegativeInteger(args.maxModels, 'max-models')
  assertPositiveInteger(args.scenarioCount, 'scenario-count')
  assertPositiveInteger(args.userIndex, 'user-index')
  assertPositiveInteger(args.userCount, 'user-count')
  assertPositiveInteger(args.maxRequestsPerUser, 'max-requests-per-user')
  assertPositiveInteger(args.requestTimeoutMs, 'request-timeout-ms')
  assertPositiveInteger(args.maxStreamBytes, 'max-stream-bytes')
  assertNonNegativeInteger(args.maxRetries, 'max-retries')
  assertPositiveInteger(args.retryBaseMs, 'retry-base-ms')
  assertPositiveInteger(args.retryMaxMs, 'retry-max-ms')
  assertNonNegativeInteger(args.maxCorpusProducts, 'max-corpus-products')

  if (args.retryBaseMs > args.retryMaxMs) {
    throw new Error('retry-base-ms no puede ser mayor que retry-max-ms')
  }

  const ignoredProviderSet = parseProvidersCsv(args.ignoreProviderErrorsRaw)
  if (ignoredProviderSet.size > 0) {
    console.warn(
      `[compare-chat-models] Advertencia: se ignorarán http-error de proveedor para scoring: ${[
        ...ignoredProviderSet,
      ].join(', ')}`,
    )
  }

  const mongodbUri = readEnvValue('MONGODB_URI')
  if (!mongodbUri) {
    throw new Error('MONGODB_URI es requerido')
  }

  const jwtSecret = readEnvValue('JWT_SECRET')
  if (!jwtSecret) {
    throw new Error('JWT_SECRET es requerido')
  }

  await mongoose.connect(mongodbUri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
  })

  const db = mongoose.connection.db
  const usersCollection = db.collection('users')
  const sessionsCollection = db.collection('sessions')
  const productsCollection = db.collection('academicproducts')

  const userContexts = []
  let primaryUserEmail = ''
  let primaryCookieHeader = ''

  try {
    for (let offset = 0; offset < args.userCount; offset += 1) {
      const userSequence = args.userIndex + offset
      const userEmail = `seed-${args.runId}-u${String(userSequence).padStart(2, '0')}@sipac.test`
      const user = await usersCollection.findOne(
        { email: userEmail },
        { projection: { _id: 1, tokenVersion: 1 } },
      )

      if (!user?._id) {
        throw new Error(`No existe usuario seed para run-id ${args.runId}: ${userEmail}`)
      }

      const jti = `chat-compare-${randomUUID()}`
      const now = new Date()
      const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000)

      await sessionsCollection.insertOne({
        userId: user._id,
        jti,
        expiresAt,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      })

      const token = await new SignJWT({
        role: 'docente',
        email: userEmail,
        tokenVersion: Number.isInteger(user.tokenVersion) ? user.tokenVersion : 0,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(String(user._id))
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
        .sign(new TextEncoder().encode(jwtSecret))

      userContexts.push({
        userId: String(user._id),
        email: userEmail,
        jti,
        cookieHeader: `sipac_session=${token}`,
        requestCount: 0,
      })
    }

    if (args.resetRateLimitBuckets) {
      await db.collection('chatratelimitbuckets').deleteMany({
        userId: { $in: userContexts.map((context) => context.userId) },
      })
    }

    primaryUserEmail = userContexts[0].email
    primaryCookieHeader = userContexts[0].cookieHeader

    let providersResponse = null
    const providerAttempts = args.maxRetries + 1

    for (let attempt = 1; attempt <= providerAttempts; attempt += 1) {
      try {
        const currentResponse = await requestJson(
          `${args.baseUrl}/api/chat/providers`,
          {
            headers: {
              cookie: primaryCookieHeader,
            },
          },
          args.requestTimeoutMs,
        )

        if (
          !currentResponse.ok &&
          shouldRetryHttpStatus(currentResponse.status) &&
          attempt < providerAttempts
        ) {
          const delayMs = resolveRetryDelayMs(
            attempt,
            args.retryBaseMs,
            args.retryMaxMs,
            currentResponse.retryAfterMs,
          )
          await sleepMs(delayMs)
          continue
        }

        providersResponse = currentResponse
        break
      } catch (error) {
        const status = classifyTransportError(error)
        const retryable = isRetryableTransportStatus(status)
        if (retryable && attempt < providerAttempts) {
          const delayMs = resolveRetryDelayMs(attempt, args.retryBaseMs, args.retryMaxMs)
          await sleepMs(delayMs)
          continue
        }

        throw error
      }
    }

    if (!providersResponse?.ok) {
      throw new Error(
        `No se pudo consultar /api/chat/providers (${providersResponse?.status ?? 'sin-status'}): ${providersResponse?.bodyText?.slice(0, 240) ?? 'sin cuerpo'}`,
      )
    }

    const providerData = providersResponse.json?.data
    const manualOptions = normalizeDiscoveredModels(
      Array.isArray(providerData?.manualOptions) ? providerData.manualOptions : [],
    )

    const requestedModels = parseModelsCsv(args.modelsRaw)
    const selectedModels =
      requestedModels.length > 0
        ? requestedModels
        : args.maxModels > 0
          ? manualOptions.slice(0, args.maxModels)
          : manualOptions

    if (selectedModels.length === 0) {
      throw new Error('No hay modelos manuales disponibles para comparar')
    }

    const allProducts = await productsCollection
      .find(
        {
          reviewStatus: 'confirmed',
          isDeleted: { $ne: true },
        },
        {
          projection: {
            _id: 1,
            productType: 1,
            referenceDate: 1,
            manualMetadata: 1,
          },
        },
      )
      .toArray()

    let corpus = allProducts.map(normalizeCorpusProduct).filter(Boolean)

    if (args.maxCorpusProducts > 0) {
      corpus = corpus
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .slice(0, args.maxCorpusProducts)
    }

    if (corpus.length === 0) {
      throw new Error('No se encontraron productos confirmados aptos para crear escenarios')
    }

    const scenarios = buildScenarios(corpus, args.runId, args.scenarioCount)
    const totalPlannedRequests = selectedModels.length * scenarios.length
    const requestCapacity = userContexts.length * args.maxRequestsPerUser

    if (totalPlannedRequests > requestCapacity) {
      throw new Error(
        `Capacidad insuficiente para evitar 429: requests=${totalPlannedRequests}, capacidad=${requestCapacity}. Ajusta --user-count o --max-requests-per-user.`,
      )
    }

    let remainingRetryBudget = Math.max(0, requestCapacity - totalPlannedRequests)

    const records = []
    let nextUserCursor = 0

    const getNextUserContext = () => {
      for (let search = 0; search < userContexts.length; search += 1) {
        const context = userContexts[nextUserCursor % userContexts.length]
        nextUserCursor += 1

        if (context.requestCount >= args.maxRequestsPerUser) {
          continue
        }

        context.requestCount += 1
        return context
      }

      return null
    }

    const canRetry = (attempt, maxAttempts) => attempt < maxAttempts && remainingRetryBudget > 0

    const reserveRetryBudget = () => {
      remainingRetryBudget = Math.max(0, remainingRetryBudget - 1)
    }

    for (const model of selectedModels) {
      for (const scenario of scenarios) {
        const maxAttempts = args.maxRetries + 1
        let scenarioRecord = null

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const userContext = getNextUserContext()
          if (!userContext) {
            scenarioRecord = {
              model,
              scenario: compactScenarioForRecord(scenario),
              status: 'capacity-error',
              ignoredFailure: isIgnoredFailureStatus(
                'capacity-error',
                model.provider,
                ignoredProviderSet,
              ),
              latencyMs: 0,
              streamBytes: 0,
              assistantText: '',
              assistantMetadata: null,
              assistantPartTypes: [],
              toolOutputs: [],
              evaluation: failureEvaluation('capacity-error'),
              error:
                'No hay usuarios seed con cupo disponible para continuar. Aumenta --user-count o --max-requests-per-user.',
              attempt,
              userEmail: null,
            }
            break
          }

          const chatId = `cmp-${args.runId}-${model.provider}-${randomUUID().slice(0, 8)}-a${attempt}`
          const requestStartedAt = Date.now()

          let chatResponse
          try {
            chatResponse = await fetchWithTimeout(
              `${args.baseUrl}/api/chat`,
              {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  cookie: userContext.cookieHeader,
                },
                body: JSON.stringify({
                  id: chatId,
                  trigger: 'submit-message',
                  selectedModel: model,
                  messages: [
                    {
                      id: `msg-${randomUUID().slice(0, 10)}`,
                      role: 'user',
                      parts: [{ type: 'text', text: scenario.question }],
                      metadata: { createdAt: Date.now() },
                    },
                  ],
                }),
              },
              args.requestTimeoutMs,
            )
          } catch (error) {
            const status = classifyTransportError(error)
            const shouldRetry = isRetryableTransportStatus(status) && canRetry(attempt, maxAttempts)

            if (shouldRetry) {
              reserveRetryBudget()
              const delayMs = resolveRetryDelayMs(attempt, args.retryBaseMs, args.retryMaxMs)
              await sleepMs(delayMs)
              continue
            }

            scenarioRecord = {
              model,
              scenario: compactScenarioForRecord(scenario),
              status,
              ignoredFailure: isIgnoredFailureStatus(status, model.provider, ignoredProviderSet),
              latencyMs: Date.now() - requestStartedAt,
              streamBytes: 0,
              assistantText: '',
              assistantMetadata: null,
              assistantPartTypes: [],
              toolOutputs: [],
              evaluation: failureEvaluation(status),
              error: error instanceof Error ? error.message : String(error),
              attempt,
              userEmail: userContext.email,
            }
            break
          }

          let streamBytes = 0
          try {
            streamBytes = await consumeStreamBody(
              chatResponse,
              args.requestTimeoutMs,
              args.maxStreamBytes,
            )
          } catch (error) {
            const status = classifyTransportError(error)
            const shouldRetry = isRetryableTransportStatus(status) && canRetry(attempt, maxAttempts)

            if (shouldRetry) {
              reserveRetryBudget()
              const delayMs = resolveRetryDelayMs(attempt, args.retryBaseMs, args.retryMaxMs)
              await sleepMs(delayMs)
              continue
            }

            scenarioRecord = {
              model,
              scenario: compactScenarioForRecord(scenario),
              status,
              ignoredFailure: isIgnoredFailureStatus(status, model.provider, ignoredProviderSet),
              latencyMs: Date.now() - requestStartedAt,
              streamBytes: 0,
              assistantText: '',
              assistantMetadata: null,
              assistantPartTypes: [],
              toolOutputs: [],
              evaluation: failureEvaluation(status),
              error: error instanceof Error ? error.message : String(error),
              attempt,
              userEmail: userContext.email,
            }
            break
          }

          const latencyMs = Date.now() - requestStartedAt

          if (!chatResponse.ok) {
            const retryAfterMs = parseRetryAfterMs(chatResponse)
            const shouldRetry =
              shouldRetryHttpStatus(chatResponse.status) && canRetry(attempt, maxAttempts)

            if (shouldRetry) {
              reserveRetryBudget()
              const delayMs = resolveRetryDelayMs(
                attempt,
                args.retryBaseMs,
                args.retryMaxMs,
                retryAfterMs,
              )
              await sleepMs(delayMs)
              continue
            }

            scenarioRecord = {
              model,
              scenario: compactScenarioForRecord(scenario),
              status: 'http-error',
              ignoredFailure: isIgnoredFailureStatus(
                'http-error',
                model.provider,
                ignoredProviderSet,
              ),
              latencyMs,
              streamBytes,
              assistantText: '',
              assistantMetadata: null,
              assistantPartTypes: [],
              toolOutputs: [],
              evaluation: failureEvaluation('http-error'),
              error: `POST /api/chat failed with status ${chatResponse.status}`,
              attempt,
              userEmail: userContext.email,
            }
            break
          }

          let conversationResponse
          try {
            conversationResponse = await requestJson(
              `${args.baseUrl}/api/chat/conversations/${encodeURIComponent(chatId)}`,
              {
                headers: {
                  cookie: userContext.cookieHeader,
                },
              },
              args.requestTimeoutMs,
            )
          } catch (error) {
            const status = classifyTransportError(error)
            const shouldRetry = isRetryableTransportStatus(status) && canRetry(attempt, maxAttempts)

            if (shouldRetry) {
              reserveRetryBudget()
              const delayMs = resolveRetryDelayMs(attempt, args.retryBaseMs, args.retryMaxMs)
              await sleepMs(delayMs)
              continue
            }

            scenarioRecord = {
              model,
              scenario: compactScenarioForRecord(scenario),
              status,
              ignoredFailure: isIgnoredFailureStatus(status, model.provider, ignoredProviderSet),
              latencyMs,
              streamBytes,
              assistantText: '',
              assistantMetadata: null,
              assistantPartTypes: [],
              toolOutputs: [],
              evaluation: failureEvaluation(status),
              error: error instanceof Error ? error.message : String(error),
              attempt,
              userEmail: userContext.email,
            }
            break
          }

          if (!conversationResponse.ok) {
            const shouldRetry =
              shouldRetryHttpStatus(conversationResponse.status) && canRetry(attempt, maxAttempts)

            if (shouldRetry) {
              reserveRetryBudget()
              const delayMs = resolveRetryDelayMs(attempt, args.retryBaseMs, args.retryMaxMs)
              await sleepMs(delayMs)
              continue
            }

            scenarioRecord = {
              model,
              scenario: compactScenarioForRecord(scenario),
              status: 'conversation-error',
              ignoredFailure: isIgnoredFailureStatus(
                'conversation-error',
                model.provider,
                ignoredProviderSet,
              ),
              latencyMs,
              streamBytes,
              assistantText: '',
              assistantMetadata: null,
              assistantPartTypes: [],
              toolOutputs: [],
              evaluation: failureEvaluation('conversation-error'),
              error: `GET /api/chat/conversations/:id failed with status ${conversationResponse.status}`,
              attempt,
              userEmail: userContext.email,
            }
            break
          }

          const conversation = conversationResponse.json?.data?.conversation
          const messages = Array.isArray(conversation?.messages) ? conversation.messages : []
          const assistantMessage = [...messages]
            .reverse()
            .find((message) => message.role === 'assistant')
          const assistantText = extractMessageText(assistantMessage)
          const toolOutputs = extractToolOutputs(messages)

          if (
            !assistantMessage ||
            (assistantText.trim().length === 0 && toolOutputs.length === 0)
          ) {
            const shouldRetry = canRetry(attempt, maxAttempts)

            if (shouldRetry) {
              reserveRetryBudget()
              const delayMs = resolveRetryDelayMs(attempt, args.retryBaseMs, args.retryMaxMs)
              await sleepMs(delayMs)
              continue
            }

            scenarioRecord = {
              model,
              scenario: compactScenarioForRecord(scenario),
              status: 'conversation-error',
              ignoredFailure: isIgnoredFailureStatus(
                'conversation-error',
                model.provider,
                ignoredProviderSet,
              ),
              latencyMs,
              streamBytes,
              assistantText: '',
              assistantMetadata: null,
              assistantPartTypes: [],
              toolOutputs: [],
              evaluation: failureEvaluation('conversation-error'),
              error: 'La conversacion no incluyo una respuesta util del asistente.',
              attempt,
              userEmail: userContext.email,
            }
            break
          }

          const baseRecord = {
            model,
            scenario,
            status: 'ok',
            ignoredFailure: false,
            latencyMs,
            streamBytes,
            assistantText,
            assistantMetadata: assistantMessage?.metadata ?? null,
            assistantPartTypes: Array.isArray(assistantMessage?.parts)
              ? assistantMessage.parts.map((part) => part?.type).filter(Boolean)
              : [],
            toolOutputs,
            attempt,
            userEmail: userContext.email,
          }

          const evaluation = evaluateScenario(baseRecord)
          scenarioRecord = {
            ...baseRecord,
            scenario: compactScenarioForRecord(scenario),
            assistantText: assistantText.slice(0, MAX_STORED_ASSISTANT_TEXT_CHARS),
            toolOutputs: compactToolOutputsForRecord(evaluation.compactToolOutputs),
            evaluation: compactEvaluationForRecord(evaluation),
          }
          break
        }

        records.push(scenarioRecord)
      }
    }

    const summaryByModel = aggregateByModel(records, ignoredProviderSet)
    const globalSummary = buildGlobalSummary(records, summaryByModel, ignoredProviderSet)

    const report = {
      generatedAt: new Date().toISOString(),
      runId: args.runId,
      baseUrl: args.baseUrl,
      userEmail: primaryUserEmail,
      userEmails: userContexts.map((context) => context.email),
      config: {
        scenarioCount: args.scenarioCount,
        maxModels: args.maxModels,
        userIndex: args.userIndex,
        userCount: args.userCount,
        maxRequestsPerUser: args.maxRequestsPerUser,
        ignoreProviderErrors: [...ignoredProviderSet],
        requestTimeoutMs: args.requestTimeoutMs,
        maxStreamBytes: args.maxStreamBytes,
        maxRetries: args.maxRetries,
        retryBaseMs: args.retryBaseMs,
        retryMaxMs: args.retryMaxMs,
        maxCorpusProducts: args.maxCorpusProducts,
        resetRateLimitBuckets: args.resetRateLimitBuckets,
      },
      corpusSummary: summarizeCorpus(corpus),
      models: selectedModels,
      scenarios: scenarios.map((scenario) => ({
        id: scenario.id,
        category: scenario.category,
        question: scenario.question,
        expectNoResults: scenario.expectNoResults,
        expectedCount: scenario.expectedCount,
        expectedSignals: scenario.expectedSignals,
        expectedProductIds: scenario.expectedProductIds,
      })),
      summaryByModel,
      globalSummary,
      records,
    }

    const defaultOutput = `docs/evidencias/chat-model-comparison-${args.runId}-${Date.now()}.json`
    const outputPath = resolve(args.outputPath || defaultOutput)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

    console.info(
      JSON.stringify(
        {
          runId: args.runId,
          modelsCompared: selectedModels.length,
          scenarios: scenarios.length,
          corpusSize: corpus.length,
          outputPath,
        },
        null,
        2,
      ),
    )
  } finally {
    try {
      if (userContexts.length > 0) {
        await sessionsCollection.deleteMany({
          jti: { $in: userContexts.map((context) => context.jti) },
        })
      }
    } catch (error) {
      console.warn('[compare-chat-models] cleanup de sesiones fallo', error)
    }

    try {
      await mongoose.disconnect()
    } catch (error) {
      console.warn('[compare-chat-models] disconnect de mongoose fallo', error)
    }
  }
}

main().catch(async (error) => {
  console.error('[compare-chat-models] failed', error)

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect()
  }

  process.exitCode = 1
})
