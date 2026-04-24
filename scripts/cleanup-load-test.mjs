import mongoose from 'mongoose'

const ALLOW_LOAD_TEST_SCRIPTS_ENV = 'ALLOW_LOAD_TEST_SCRIPTS'
const ALLOW_LOAD_TEST_ON_PROD_ENV = 'ALLOW_LOAD_TEST_ON_PROD'

function parseArgs(argv) {
  const args = { runId: '', yes: false }

  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      args.help = true
      continue
    }

    if (arg === '--yes') {
      args.yes = true
      continue
    }

    if (arg.startsWith('--run-id=')) {
      args.runId = arg.slice('--run-id='.length).trim()
      continue
    }

    throw new Error(`Argumento no reconocido: ${arg}`)
  }

  return args
}

function printHelp() {
  console.info('Uso: node scripts/cleanup-load-test.mjs --run-id=<id> [--yes]')
  console.info('Por seguridad, sin --yes solo muestra conteos y no elimina datos.')
  console.info('Variables: MONGODB_URI requerido')
  console.info(`  ${ALLOW_LOAD_TEST_SCRIPTS_ENV}=1 requerido para permitir borrado`)
  console.info(
    `  ${ALLOW_LOAD_TEST_ON_PROD_ENV}=1 requerido solo si detecta un target potencialmente productivo`,
  )
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
      `${ALLOW_LOAD_TEST_SCRIPTS_ENV}=1 es requerido para ejecutar ${scriptLabel} y evitar borrado accidental.`,
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

async function main() {
  const args = parseArgs(process.argv)

  if (args.help) {
    printHelp()
    return
  }

  if (!args.runId) {
    throw new Error('Debes indicar --run-id=<id>')
  }

  const mongodbUri = process.env.MONGODB_URI?.trim()
  if (!mongodbUri) {
    throw new Error('MONGODB_URI es requerido')
  }

  assertExecutionSafety(mongodbUri, 'cleanup-load-test')

  await mongoose.connect(mongodbUri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
  })

  const db = mongoose.connection.db

  const usersCollection = db.collection('users')
  const uploadedFilesCollection = db.collection('uploadedfiles')
  const academicProductsCollection = db.collection('academicproducts')
  const sessionsCollection = db.collection('sessions')
  const chatConversationsCollection = db.collection('chatconversations')
  const chatRateBucketsCollection = db.collection('chatratelimitbuckets')
  const uploadsFilesCollection = db.collection('uploads.files')
  const uploadsChunksCollection = db.collection('uploads.chunks')

  const userEmailRegex = new RegExp(`^seed-${escapeRegExp(args.runId)}-u\\d+@sipac\\.test$`)
  const filenameRegex = new RegExp(`^seed-${escapeRegExp(args.runId)}-\\d+\\.`)
  const noteRegex = new RegExp(`\\[seed:${escapeRegExp(args.runId)}\\]`)

  const users = await usersCollection.find({ email: userEmailRegex }).project({ _id: 1 }).toArray()
  const userIds = users.map((user) => user._id)

  const uploadedFiles = await uploadedFilesCollection
    .find({
      $or: [{ uploadedBy: { $in: userIds } }, { originalFilename: filenameRegex }],
    })
    .project({ _id: 1, gridfsFileId: 1 })
    .toArray()

  const uploadedFileIds = uploadedFiles.map((file) => file._id)
  const gridfsFileIds = uploadedFiles
    .map((file) => file.gridfsFileId)
    .filter((fileId) => fileId != null)

  const runGridFiles = await uploadsFilesCollection
    .find({
      $or: [{ _id: { $in: gridfsFileIds } }, { 'metadata.testRunId': args.runId }],
    })
    .project({ _id: 1 })
    .toArray()

  const runGridFileIds = runGridFiles.map((file) => file._id)

  const preflight = {
    runId: args.runId,
    dryRun: !args.yes,
    totals: {
      users: users.length,
      uploadedFiles: uploadedFileIds.length,
      academicProducts: await academicProductsCollection.countDocuments({
        $or: [
          { owner: { $in: userIds } },
          { sourceFile: { $in: uploadedFileIds } },
          { 'manualMetadata.notes': noteRegex },
        ],
      }),
      sessions: await sessionsCollection.countDocuments({ userId: { $in: userIds } }),
      chatConversations: await chatConversationsCollection.countDocuments({
        userId: { $in: userIds },
      }),
      chatRateBuckets: await chatRateBucketsCollection.countDocuments({ userId: { $in: userIds } }),
      gridfsFiles: await uploadsFilesCollection.countDocuments({ _id: { $in: runGridFileIds } }),
      gridfsChunks: await uploadsChunksCollection.countDocuments({
        files_id: { $in: runGridFileIds },
      }),
    },
  }

  if (!args.yes) {
    console.info(JSON.stringify(preflight, null, 2))
    console.info('Dry-run completado. Ejecuta de nuevo con --yes para eliminar.')
    await mongoose.disconnect()
    return
  }

  const deleteProductsResult = await academicProductsCollection.deleteMany({
    $or: [
      { owner: { $in: userIds } },
      { sourceFile: { $in: uploadedFileIds } },
      { 'manualMetadata.notes': noteRegex },
    ],
  })

  const deleteUploadedFilesResult = await uploadedFilesCollection.deleteMany({
    _id: { $in: uploadedFileIds },
  })

  const deleteChunksResult = await uploadsChunksCollection.deleteMany({
    files_id: { $in: runGridFileIds },
  })

  const deleteGridFilesResult = await uploadsFilesCollection.deleteMany({
    _id: { $in: runGridFileIds },
  })

  const deleteSessionsResult = await sessionsCollection.deleteMany({ userId: { $in: userIds } })
  const deleteConversationsResult = await chatConversationsCollection.deleteMany({
    userId: { $in: userIds },
  })
  const deleteRateBucketsResult = await chatRateBucketsCollection.deleteMany({
    userId: { $in: userIds },
  })
  const deleteUsersResult = await usersCollection.deleteMany({ _id: { $in: userIds } })

  console.info(
    JSON.stringify(
      {
        runId: args.runId,
        dryRun: false,
        deleted: {
          users: deleteUsersResult.deletedCount,
          uploadedFiles: deleteUploadedFilesResult.deletedCount,
          academicProducts: deleteProductsResult.deletedCount,
          sessions: deleteSessionsResult.deletedCount,
          chatConversations: deleteConversationsResult.deletedCount,
          chatRateBuckets: deleteRateBucketsResult.deletedCount,
          gridfsFiles: deleteGridFilesResult.deletedCount,
          gridfsChunks: deleteChunksResult.deletedCount,
        },
      },
      null,
      2,
    ),
  )

  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error('[cleanup-load-test] failed', error)
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect()
  }
  process.exitCode = 1
})
