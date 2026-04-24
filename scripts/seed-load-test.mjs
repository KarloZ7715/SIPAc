import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'

const PRODUCT_TYPES = [
  'article',
  'conference_paper',
  'thesis',
  'certificate',
  'research_project',
  'book',
  'book_chapter',
  'technical_report',
  'software',
  'patent',
]

const FORMAT_CATEGORIES = ['pdf', 'image', 'docx', 'xlsx', 'pptx']

const MIME_BY_FORMAT = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

const OCR_PROVIDER_BY_CATEGORY = {
  pdf: 'pdfjs_native',
  image: 'gemini_vision',
  docx: 'office_native',
  xlsx: 'office_native',
  pptx: 'office_native',
}

const OCR_MODEL_BY_CATEGORY = {
  pdf: 'pdfjs_native',
  image: 'gemini-2.5-flash',
  docx: 'office_native',
  xlsx: 'office_native',
  pptx: 'office_native',
}

const DEFAULT_TOTAL = 500
const DEFAULT_USERS = 15
const DEFAULT_BATCH_SIZE = 100
const SEEDED_BY = 'sipac-load-seed'
const ALLOW_LOAD_TEST_SCRIPTS_ENV = 'ALLOW_LOAD_TEST_SCRIPTS'
const ALLOW_LOAD_TEST_ON_PROD_ENV = 'ALLOW_LOAD_TEST_ON_PROD'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a\nHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy\nMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA\nAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEB\nAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdAAH/\n2Q==',
  'base64',
)

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)
const fixtureDocxPath = join(projectRoot, 'tests/e2e/fixtures/e2e-academic.docx')
const fixtureXlsxPath = join(projectRoot, 'tests/e2e/fixtures/e2e-academic.xlsx')
const fixturePptxPath = join(projectRoot, 'tests/e2e/fixtures/e2e-academic.pptx')

const OFFICE_FIXTURES = {
  docx: readFileSync(fixtureDocxPath),
  xlsx: readFileSync(fixtureXlsxPath),
  pptx: readFileSync(fixturePptxPath),
}

const INSTITUTIONS = [
  'Universidad de Cordoba',
  'Universidad Nacional de Colombia',
  'Universidad de Antioquia',
  'Universidad del Valle',
  'Universidad Industrial de Santander',
]

const KEYWORD_SETS = [
  ['inteligencia artificial', 'educacion', 'analitica'],
  ['aprendizaje automatico', 'curriculo', 'evaluacion'],
  ['procesamiento de lenguaje', 'repositorio', 'investigacion'],
  ['sistemas expertos', 'pedagogia digital', 'innovacion'],
  ['mineria de datos', 'ciencia abierta', 'calidad academica'],
]

const RESEARCH_LINES = [
  'Transformacion Digital Educativa',
  'Analitica de Aprendizaje',
  'Calidad e Innovacion Curricular',
  'Gobernanza de Datos Academicos',
]

function buildAcademicPdfBuffer() {
  const lines = [
    'Universidad de Cordoba. Revista Latinoamericana de Educacion.',
    'Autores: Maria Fernandez y Carlos Gomez.',
    'Analisis de inteligencia artificial en educacion superior.',
    'DOI 10.1234/sipac.seed. Keywords: pedagogia digital, evaluacion.',
  ]

  const escaped = lines.map((line) =>
    line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'),
  )

  let stream = 'BT\n/F1 11 Tf\n48 720 Td\n'
  stream += `(${escaped[0]}) Tj\n`
  for (let i = 1; i < escaped.length; i += 1) {
    stream += '0 -16 Td\n'
    stream += `(${escaped[i]}) Tj\n`
  }
  stream += 'ET\n'

  const streamBody = Buffer.from(stream, 'latin1')
  const obj1 = Buffer.from('1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n', 'latin1')
  const obj2 = Buffer.from('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n', 'latin1')
  const obj3 = Buffer.from(
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n',
    'latin1',
  )
  const obj4Head = Buffer.from(`4 0 obj<</Length ${streamBody.length}>>stream\n`, 'latin1')
  const obj4Tail = Buffer.from('\nendstream\nendobj\n', 'latin1')
  const obj5 = Buffer.from(
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n',
    'latin1',
  )

  const header = Buffer.from('%PDF-1.4\n', 'latin1')
  const objects = [obj1, obj2, obj3, obj4Head, streamBody, obj4Tail, obj5]

  const offsets = [0]
  let position = header.length
  const objectBuffers = [header]

  for (const objectBuffer of objects) {
    offsets.push(position)
    objectBuffers.push(objectBuffer)
    position += objectBuffer.length
  }

  const xrefStart = position
  const objectCount = objects.length + 1
  let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`

  for (let i = 1; i < objectCount; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }

  const xrefBuffer = Buffer.from(xref, 'latin1')
  const trailer = Buffer.from(
    `trailer<</Size ${objectCount}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`,
    'latin1',
  )

  return Buffer.concat([...objectBuffers, xrefBuffer, trailer])
}

function parseArgs(argv) {
  const args = {
    runId: '',
    total: DEFAULT_TOTAL,
    users: DEFAULT_USERS,
    batchSize: DEFAULT_BATCH_SIZE,
    force: false,
  }

  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      args.help = true
      continue
    }

    if (arg === '--force') {
      args.force = true
      continue
    }

    if (arg.startsWith('--run-id=')) {
      args.runId = arg.slice('--run-id='.length).trim()
      continue
    }

    if (arg.startsWith('--total=')) {
      args.total = Number.parseInt(arg.slice('--total='.length), 10)
      continue
    }

    if (arg.startsWith('--users=')) {
      args.users = Number.parseInt(arg.slice('--users='.length), 10)
      continue
    }

    if (arg.startsWith('--batch=')) {
      args.batchSize = Number.parseInt(arg.slice('--batch='.length), 10)
      continue
    }

    if (arg === '--run-id' || arg === '--total' || arg === '--users' || arg === '--batch') {
      throw new Error(`Argumento incompleto: ${arg}`)
    }

    throw new Error(`Argumento no reconocido: ${arg}`)
  }

  return args
}

function printHelp() {
  console.info('Uso: node scripts/seed-load-test.mjs --run-id=<id> [opciones]')
  console.info('')
  console.info('Opciones:')
  console.info(`  --total=<n>     Total de documentos (default: ${DEFAULT_TOTAL})`)
  console.info(`  --users=<n>     Total de usuarios semilla (default: ${DEFAULT_USERS})`)
  console.info(`  --batch=<n>     Tamano de lote insertMany (default: ${DEFAULT_BATCH_SIZE})`)
  console.info('  --force         Reutiliza run-id borrando primero data previa de ese run-id')
  console.info('  --help          Muestra esta ayuda')
  console.info('')
  console.info('Variables:')
  console.info('  MONGODB_URI requerido')
  console.info(`  ${ALLOW_LOAD_TEST_SCRIPTS_ENV}=1 requerido para permitir escrituras`)
  console.info(
    `  ${ALLOW_LOAD_TEST_ON_PROD_ENV}=1 requerido solo si detecta un target potencialmente productivo`,
  )
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} debe ser un entero positivo`)
  }
}

function parseMongoTarget(mongodbUri) {
  try {
    const parsed = new URL(mongodbUri)
    const databaseName = parsed.pathname?.replace(/^\//, '') || '(default)'

    return {
      host: parsed.host || '(unknown-host)',
      databaseName,
      isLikelyProduction:
        /prod|production/i.test(parsed.host) || /prod|production/i.test(databaseName),
    }
  } catch {
    return {
      host: '(parse-error)',
      databaseName: '(parse-error)',
      isLikelyProduction: false,
    }
  }
}

function assertExecutionSafety(mongodbUri, scriptLabel) {
  if (process.env[ALLOW_LOAD_TEST_SCRIPTS_ENV] !== '1') {
    throw new Error(
      `${ALLOW_LOAD_TEST_SCRIPTS_ENV}=1 es requerido para ejecutar ${scriptLabel} y evitar escrituras accidentales.`,
    )
  }

  const target = parseMongoTarget(mongodbUri)
  console.info(
    `[${scriptLabel}] target host=${target.host} db=${target.databaseName} prodLike=${String(target.isLikelyProduction)}`,
  )

  if (target.isLikelyProduction && process.env[ALLOW_LOAD_TEST_ON_PROD_ENV] !== '1') {
    throw new Error(
      `Target potencialmente productivo detectado. Define ${ALLOW_LOAD_TEST_ON_PROD_ENV}=1 para continuar bajo tu responsabilidad.`,
    )
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toObjectIdStringSet(values) {
  return new Set(values.map((value) => String(value)))
}

function buildRunMatchers(runId) {
  return {
    userEmailRegex: new RegExp(`^seed-${escapeRegExp(runId)}-u\\d+@sipac\\.test$`),
    filenameRegex: new RegExp(`^seed-${escapeRegExp(runId)}-\\d+\\.`),
    noteRegex: new RegExp(`\\[seed:${escapeRegExp(runId)}\\]`),
  }
}

async function cleanupRunArtifacts(db, runId) {
  const usersCollection = db.collection('users')
  const uploadedFilesCollection = db.collection('uploadedfiles')
  const academicProductsCollection = db.collection('academicproducts')
  const sessionsCollection = db.collection('sessions')
  const chatConversationsCollection = db.collection('chatconversations')
  const chatRateBucketsCollection = db.collection('chatratelimitbuckets')
  const uploadsFilesCollection = db.collection('uploads.files')
  const uploadsChunksCollection = db.collection('uploads.chunks')

  const { userEmailRegex, filenameRegex, noteRegex } = buildRunMatchers(runId)

  const users = await usersCollection.find({ email: userEmailRegex }).project({ _id: 1 }).toArray()
  const userIds = users.map((user) => user._id)

  const uploadedFiles = await uploadedFilesCollection
    .find({
      $or: [{ uploadedBy: { $in: userIds } }, { originalFilename: filenameRegex }],
    })
    .project({ _id: 1, gridfsFileId: 1 })
    .toArray()

  const uploadedFileIds = uploadedFiles.map((file) => file._id)
  const uploadedGridIds = uploadedFiles
    .map((file) => file.gridfsFileId)
    .filter((gridfsFileId) => gridfsFileId != null)

  const runGridFiles = await uploadsFilesCollection
    .find({
      $or: [{ _id: { $in: uploadedGridIds } }, { 'metadata.testRunId': runId }],
    })
    .project({ _id: 1 })
    .toArray()

  const runGridFileIds = runGridFiles.map((file) => file._id)
  const runGridFileIdSet = toObjectIdStringSet(runGridFileIds)

  await academicProductsCollection.deleteMany({
    $or: [
      { owner: { $in: userIds } },
      { sourceFile: { $in: uploadedFileIds } },
      { 'manualMetadata.notes': noteRegex },
    ],
  })

  await uploadedFilesCollection.deleteMany({ _id: { $in: uploadedFileIds } })
  await uploadsChunksCollection.deleteMany({ files_id: { $in: runGridFileIds } })
  await uploadsFilesCollection.deleteMany({ _id: { $in: runGridFileIds } })
  await sessionsCollection.deleteMany({ userId: { $in: userIds } })
  await chatConversationsCollection.deleteMany({ userId: { $in: userIds } })
  await chatRateBucketsCollection.deleteMany({ userId: { $in: userIds } })
  await usersCollection.deleteMany({ _id: { $in: userIds } })

  return {
    users: userIds.length,
    uploadedFiles: uploadedFileIds.length,
    gridfsFiles: runGridFileIdSet.size,
  }
}

function buildUserEmail(runId, userIndex) {
  return `seed-${runId}-u${String(userIndex + 1).padStart(2, '0')}@sipac.test`
}

function pickFormatForIndex(index) {
  const category = FORMAT_CATEGORIES[index % FORMAT_CATEGORIES.length]

  if (category !== 'image') {
    return category
  }

  return Math.floor(index / FORMAT_CATEGORIES.length) % 2 === 0 ? 'png' : 'jpeg'
}

function buildSubtypeFields(productType, context) {
  const { publicationDate, institution, keywordSeed, runId, docIndex, authorA, authorB } = context

  if (productType === 'article') {
    return {
      journalName: `Revista SIPAc ${runId.toUpperCase()}`,
      volume: String((docIndex % 8) + 1),
      issue: String((docIndex % 4) + 1),
      pages: `${(docIndex % 50) + 1}-${(docIndex % 50) + 8}`,
      articleType: docIndex % 2 === 0 ? 'original' : 'revision',
      publisher: institution,
      areaOfKnowledge: keywordSeed,
      language: 'spanish',
      openAccess: true,
    }
  }

  if (productType === 'conference_paper') {
    return {
      eventName: `Congreso SIPAc ${publicationDate.getUTCFullYear()}`,
      eventCity: 'Monteria',
      eventCountry: 'Colombia',
      eventDate: publicationDate,
      presentationType: docIndex % 2 === 0 ? 'oral' : 'poster',
      proceedingsTitle: `Memorias ${runId.toUpperCase()}`,
      publisher: institution,
      areaOfKnowledge: keywordSeed,
      pages: `${(docIndex % 40) + 1}-${(docIndex % 40) + 6}`,
    }
  }

  if (productType === 'thesis') {
    return {
      thesisLevel: ['pregrado', 'maestria', 'doctorado'][docIndex % 3],
      director: authorB,
      university: institution,
      program: 'Maestria en Innovacion Educativa',
      approvalDate: publicationDate,
      areaOfKnowledge: keywordSeed,
      modality: 'investigacion',
      pages: (docIndex % 180) + 60,
      degreeName: 'Magister en Innovacion Educativa',
    }
  }

  if (productType === 'certificate') {
    return {
      issuingEntity: institution,
      certificateType: ['participacion', 'ponente', 'asistencia'][docIndex % 3],
      relatedEvent: `Encuentro Academico ${publicationDate.getUTCFullYear()}`,
      issueDate: publicationDate,
      hours: (docIndex % 30) + 4,
      location: 'Monteria',
      modality: 'hibrida',
      areaOfKnowledge: keywordSeed,
    }
  }

  if (productType === 'research_project') {
    return {
      projectCode: `PRJ-${runId.toUpperCase()}-${String(docIndex + 1).padStart(4, '0')}`,
      fundingSource: 'Convocatoria Interna',
      startDate: publicationDate,
      endDate: new Date(Date.UTC(publicationDate.getUTCFullYear() + 1, 5, 15)),
      projectStatus: docIndex % 2 === 0 ? 'active' : 'completed',
      coResearchers: [authorB],
      principalInvestigatorName: authorA,
      institution,
      programOrCall: 'Ciencia y Tecnologia Educativa',
      areaOfKnowledge: keywordSeed,
      keywords: [keywordSeed],
      budget: (docIndex % 12) * 5000 + 20000,
    }
  }

  if (productType === 'book') {
    return {
      bookPublisher: institution,
      bookEdition: `${(docIndex % 3) + 1}`,
      bookCity: 'Monteria',
      bookCollection: 'Coleccion SIPAc',
      bookTotalPages: (docIndex % 220) + 80,
      bookLanguage: 'spanish',
      bookPublicationDate: publicationDate,
    }
  }

  if (productType === 'book_chapter') {
    return {
      chapterBookTitle: `Libro Colectivo ${runId.toUpperCase()}`,
      chapterNumber: `${(docIndex % 15) + 1}`,
      chapterPages: `${(docIndex % 40) + 1}-${(docIndex % 40) + 10}`,
      chapterEditors: [authorB],
      chapterPublisher: institution,
      chapterLanguage: 'spanish',
      chapterPublicationDate: publicationDate,
    }
  }

  if (productType === 'technical_report') {
    return {
      reportNumber: `RPT-${runId.toUpperCase()}-${String(docIndex + 1).padStart(4, '0')}`,
      reportInstitution: institution,
      reportType: 'final',
      reportSponsor: institution,
      reportPublicationDate: publicationDate,
      reportRevision: `${(docIndex % 5) + 1}`,
      reportPages: (docIndex % 120) + 20,
      reportAreaOfKnowledge: keywordSeed,
      reportLanguage: 'spanish',
    }
  }

  if (productType === 'software') {
    return {
      softwareVersion: `v${(docIndex % 4) + 1}.${docIndex % 10}.0`,
      softwareReleaseDate: publicationDate,
      softwareRepositoryUrl: `https://repo.sipac.test/${runId}/software/${docIndex + 1}`,
      softwareLicense: 'MIT',
      softwareProgrammingLanguage: ['TypeScript', 'Python', 'R'][docIndex % 3],
      softwarePlatform: ['web', 'desktop', 'library'][docIndex % 3],
      softwareType: ['web', 'desktop', 'library'][docIndex % 3],
      softwareRegistrationNumber: `SW-${runId.toUpperCase()}-${String(docIndex + 1).padStart(4, '0')}`,
    }
  }

  return {
    patentOffice: 'Superintendencia de Industria y Comercio',
    patentApplicationNumber: `PAT-${runId.toUpperCase()}-${String(docIndex + 1).padStart(5, '0')}`,
    patentPublicationNumber: `PUB-${runId.toUpperCase()}-${String(docIndex + 1).padStart(5, '0')}`,
    patentApplicationDate: publicationDate,
    patentPublicationDate: new Date(Date.UTC(publicationDate.getUTCFullYear(), 10, 20)),
    patentStatus: ['submitted', 'published', 'granted'][docIndex % 3],
    patentAssignee: institution,
    patentInventors: [authorA, authorB],
    patentCountry: 'Colombia',
    patentClassification: 'G06N',
  }
}

function asEvidence(value, confidence) {
  return {
    value,
    confidence,
    anchors: [],
  }
}

async function uploadBufferToGridFS(bucket, input) {
  return await new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(input.filename, {
      contentType: input.contentType,
      metadata: input.metadata,
    })

    uploadStream.on('error', reject)
    uploadStream.on('finish', () => resolve(uploadStream.id))
    uploadStream.end(input.buffer)
  })
}

async function main() {
  const args = parseArgs(process.argv)

  if (args.help) {
    printHelp()
    return
  }

  const runId =
    args.runId ||
    `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8)}`
  const total = args.total
  const userCount = args.users
  const batchSize = args.batchSize

  assertPositiveInteger(total, 'total')
  assertPositiveInteger(userCount, 'users')
  assertPositiveInteger(batchSize, 'batch')

  const mongodbUri = process.env.MONGODB_URI?.trim()
  if (!mongodbUri) {
    throw new Error('MONGODB_URI es requerido')
  }

  assertExecutionSafety(mongodbUri, 'seed-load-test')

  await mongoose.connect(mongodbUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  })

  const db = mongoose.connection.db
  const usersCollection = db.collection('users')
  const uploadedFilesCollection = db.collection('uploadedfiles')
  const academicProductsCollection = db.collection('academicproducts')
  const gridFsBucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' })

  const { userEmailRegex } = buildRunMatchers(runId)

  if (args.force) {
    const deletedCounts = await cleanupRunArtifacts(db, runId)
    console.info(`[seed-load-test] --force cleanup previo aplicado`, deletedCounts)
  }

  const existingUsers = await usersCollection.countDocuments({ email: userEmailRegex })

  if (existingUsers > 0 && !args.force) {
    throw new Error(
      `Ya existe data para run-id ${runId} (${existingUsers} usuarios). Ejecuta cleanup o usa --force.`,
    )
  }

  const seedPassword = randomUUID().replace(/-/g, '')
  const passwordHash = await bcrypt.hash(seedPassword, 10)
  const users = Array.from({ length: userCount }, (_, idx) => {
    const now = new Date()
    const firstName = `Semilla${idx + 1}`
    const lastName = `Run${runId.toUpperCase()}`

    return {
      _id: new mongoose.Types.ObjectId(),
      fullName: `${firstName} ${lastName}`,
      firstName,
      middleName: null,
      lastName,
      secondLastName: null,
      namesReviewedAt: now,
      email: buildUserEmail(runId, idx),
      passwordHash,
      role: 'docente',
      isActive: true,
      program: 'Maestria en Innovacion Educativa',
      failedLoginAttempts: 0,
      lockUntil: null,
      tokenVersion: 0,
      emailVerifiedAt: now,
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    }
  })

  await usersCollection.insertMany(users, { ordered: true })

  const pdfBuffer = buildAcademicPdfBuffer()

  const formatCounters = {
    pdf: 0,
    png: 0,
    jpeg: 0,
    docx: 0,
    xlsx: 0,
    pptx: 0,
  }

  const typeCounters = Object.fromEntries(PRODUCT_TYPES.map((type) => [type, 0]))

  for (let start = 0; start < total; start += batchSize) {
    const endExclusive = Math.min(start + batchSize, total)
    const uploadedFileDocs = []
    const productDocs = []

    for (let docIndex = start; docIndex < endExclusive; docIndex += 1) {
      const user = users[docIndex % users.length]
      const format = pickFormatForIndex(docIndex)
      const productType = PRODUCT_TYPES[docIndex % PRODUCT_TYPES.length]
      const keywordSet = KEYWORD_SETS[docIndex % KEYWORD_SETS.length]
      const keywordSeed = keywordSet[0]
      const institution = INSTITUTIONS[docIndex % INSTITUTIONS.length]
      const line = RESEARCH_LINES[docIndex % RESEARCH_LINES.length]
      const publicationDate = new Date(
        Date.UTC(2018 + (docIndex % 9), docIndex % 12, 1 + (docIndex % 27)),
      )

      const authorA = `Autor ${String((docIndex % 50) + 1).padStart(2, '0')}`
      const authorB = `Coautor ${String((docIndex % 70) + 1).padStart(2, '0')}`
      const title = `${productType.replace(/_/g, ' ')} ${runId.toUpperCase()} ${String(docIndex + 1).padStart(4, '0')}`
      const doi = `10.1234/sipac.${runId}.${docIndex + 1}`

      const extension = format
      const mimeType = MIME_BY_FORMAT[format]

      const buffer =
        format === 'pdf'
          ? pdfBuffer
          : format === 'png'
            ? TINY_PNG
            : format === 'jpeg'
              ? TINY_JPEG
              : OFFICE_FIXTURES[format]

      const filename = `seed-${runId}-${String(docIndex + 1).padStart(4, '0')}.${extension}`

      const gridfsFileId = await uploadBufferToGridFS(gridFsBucket, {
        filename,
        contentType: mimeType,
        buffer,
        metadata: {
          seededBy: SEEDED_BY,
          testRunId: runId,
          format,
          productType,
          ownerEmail: user.email,
        },
      })

      const now = new Date()
      const uploadedFileId = new mongoose.Types.ObjectId()
      const ocrCategory = format === 'png' || format === 'jpeg' ? 'image' : format
      const ocrProvider = OCR_PROVIDER_BY_CATEGORY[ocrCategory]
      const ocrModel = OCR_MODEL_BY_CATEGORY[ocrCategory]

      const uploadedFileDoc = {
        _id: uploadedFileId,
        uploadedBy: user._id,
        originalFilename: filename,
        gridfsFileId,
        mimeType,
        fileSizeBytes: buffer.length,
        processingStatus: 'completed',
        processingError: null,
        rawExtractedText: `${title}. ${authorA}; ${authorB}. ${institution}. Linea: ${line}.`,
        ocrProvider,
        ocrModel,
        ocrConfidence: 0.92,
        nerProvider: 'cerebras',
        nerModel: 'qwen-3-235b-a22b-instruct-2507',
        nerAttemptTrace: [],
        documentClassification: 'academic',
        documentClassificationSource: 'heuristic',
        classificationConfidence: 0.9,
        classificationRationale: `seed-run:${runId}`,
        processingAttempt: 1,
        processingStartedAt: now,
        ocrCompletedAt: now,
        nerStartedAt: now,
        processingCompletedAt: now,
        sourceWorkCount: 1,
        nerForceSingleDocument: true,
        contentDigest: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      }

      const extractedEntities = {
        authors: [asEvidence(authorA, 0.95), asEvidence(authorB, 0.9)],
        title: asEvidence(title, 0.97),
        institution: asEvidence(institution, 0.95),
        date: asEvidence(publicationDate, 0.9),
        keywords: keywordSet.map((keyword, idx) => asEvidence(keyword, 0.84 + idx * 0.03)),
        doi: asEvidence(doi, 0.88),
        eventOrJournal: asEvidence(`Fuente ${runId.toUpperCase()}`, 0.81),
        extractionSource: ocrProvider,
        extractionConfidence: 0.91,
        extractedAt: now,
      }

      const manualMetadata = {
        title,
        authors: [authorA, authorB],
        institution,
        date: publicationDate,
        doi,
        keywords: keywordSet,
        notes: `[seed:${runId}] documento ${docIndex + 1}`,
      }

      const subtypeFields = buildSubtypeFields(productType, {
        publicationDate,
        institution,
        keywordSeed,
        runId,
        docIndex,
        authorA,
        authorB,
      })

      const productDoc = {
        _id: new mongoose.Types.ObjectId(),
        productType,
        owner: user._id,
        sourceFile: uploadedFileId,
        segmentIndex: 0,
        segmentLabel: null,
        segmentBounds: {
          pageFrom: null,
          pageTo: null,
          textStart: 0,
          textEnd: uploadedFileDoc.rawExtractedText.length,
        },
        reviewStatus: 'confirmed',
        reviewConfirmedAt: now,
        extractedEntities,
        manualMetadata,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        ...subtypeFields,
      }

      uploadedFileDocs.push(uploadedFileDoc)
      productDocs.push(productDoc)

      formatCounters[format] += 1
      typeCounters[productType] += 1
    }

    await uploadedFilesCollection.insertMany(uploadedFileDocs, { ordered: false })
    await academicProductsCollection.insertMany(productDocs, { ordered: false })

    console.info(
      `[seed-load-test] lote ${Math.floor(start / batchSize) + 1}: ${uploadedFileDocs.length} uploadedfiles y ${productDocs.length} academicproducts`,
    )
  }

  console.info('[seed-load-test] completado')
  console.info(
    JSON.stringify(
      {
        runId,
        totalDocuments: total,
        totalUsers: userCount,
        formatCounters,
        typeCounters,
      },
      null,
      2,
    ),
  )

  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error('[seed-load-test] failed', error)
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect()
  }
  process.exitCode = 1
})
