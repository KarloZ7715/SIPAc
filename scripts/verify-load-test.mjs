import mongoose from 'mongoose'

function parseArgs(argv) {
  const args = { runId: '' }

  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      args.help = true
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
  console.info('Uso: node scripts/verify-load-test.mjs --run-id=<id>')
  console.info('Variables: MONGODB_URI requerido')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toSet(values) {
  return new Set(values.map((value) => String(value)))
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

  await mongoose.connect(mongodbUri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
  })

  const db = mongoose.connection.db
  const usersCollection = db.collection('users')
  const uploadedFilesCollection = db.collection('uploadedfiles')
  const academicProductsCollection = db.collection('academicproducts')
  const uploadsFilesCollection = db.collection('uploads.files')

  const userEmailRegex = new RegExp(`^seed-${escapeRegExp(args.runId)}-u\\d+@sipac\\.test$`)
  const filenameRegex = new RegExp(`^seed-${escapeRegExp(args.runId)}-\\d+\\.`)
  const noteRegex = new RegExp(`\\[seed:${escapeRegExp(args.runId)}\\]`)

  const [users, uploadedFiles, products, gridFiles] = await Promise.all([
    usersCollection.find({ email: userEmailRegex }).project({ _id: 1, email: 1 }).toArray(),
    uploadedFilesCollection
      .find({ originalFilename: filenameRegex, isDeleted: { $ne: true } })
      .project({
        _id: 1,
        uploadedBy: 1,
        gridfsFileId: 1,
        processingStatus: 1,
        mimeType: 1,
        sourceWorkCount: 1,
      })
      .toArray(),
    academicProductsCollection
      .find({ 'manualMetadata.notes': noteRegex, isDeleted: { $ne: true } })
      .project({
        _id: 1,
        sourceFile: 1,
        owner: 1,
        reviewStatus: 1,
        productType: 1,
      })
      .toArray(),
    uploadsFilesCollection
      .find({ 'metadata.testRunId': args.runId })
      .project({ _id: 1, metadata: 1, length: 1, uploadDate: 1 })
      .toArray(),
  ])

  const userIdSet = toSet(users.map((user) => user._id))
  const uploadedIdSet = toSet(uploadedFiles.map((file) => file._id))
  const gridIdSet = toSet(gridFiles.map((file) => file._id))

  const productSourceSet = toSet(products.map((product) => product.sourceFile))
  const uploadedGridSet = toSet(uploadedFiles.map((file) => file.gridfsFileId))

  const orphanProducts = products.filter(
    (product) => !uploadedIdSet.has(String(product.sourceFile)),
  )
  const orphanUploadedFiles = uploadedFiles.filter(
    (file) => !productSourceSet.has(String(file._id)),
  )
  const orphanGridReferences = uploadedFiles.filter(
    (file) => !gridIdSet.has(String(file.gridfsFileId)),
  )
  const orphanGridFiles = gridFiles.filter((file) => !uploadedGridSet.has(String(file._id)))

  const nonCompletedUploads = uploadedFiles.filter((file) => file.processingStatus !== 'completed')
  const nonConfirmedProducts = products.filter((product) => product.reviewStatus !== 'confirmed')
  const ownerMismatchProducts = products.filter((product) => !userIdSet.has(String(product.owner)))
  const uploaderMismatchFiles = uploadedFiles.filter(
    (file) => !userIdSet.has(String(file.uploadedBy)),
  )

  const productTypeCounts = products.reduce((acc, product) => {
    const key = product.productType ?? 'unknown'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const mimeTypeCounts = uploadedFiles.reduce((acc, file) => {
    const key = file.mimeType ?? 'unknown'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const summary = {
    runId: args.runId,
    totals: {
      users: users.length,
      uploadedFiles: uploadedFiles.length,
      academicProducts: products.length,
      gridfsFiles: gridFiles.length,
    },
    integrity: {
      orphanProducts: orphanProducts.length,
      orphanUploadedFiles: orphanUploadedFiles.length,
      orphanGridReferences: orphanGridReferences.length,
      orphanGridFiles: orphanGridFiles.length,
      nonCompletedUploads: nonCompletedUploads.length,
      nonConfirmedProducts: nonConfirmedProducts.length,
      ownerMismatchProducts: ownerMismatchProducts.length,
      uploaderMismatchFiles: uploaderMismatchFiles.length,
    },
    distributions: {
      productTypeCounts,
      mimeTypeCounts,
    },
  }

  console.info(JSON.stringify(summary, null, 2))

  const hasIntegrityIssues =
    orphanProducts.length > 0 ||
    orphanUploadedFiles.length > 0 ||
    orphanGridReferences.length > 0 ||
    orphanGridFiles.length > 0 ||
    nonCompletedUploads.length > 0 ||
    nonConfirmedProducts.length > 0 ||
    ownerMismatchProducts.length > 0 ||
    uploaderMismatchFiles.length > 0

  await mongoose.disconnect()

  if (hasIntegrityIssues) {
    process.exitCode = 1
  }
}

main().catch(async (error) => {
  console.error('[verify-load-test] failed', error)
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect()
  }
  process.exitCode = 1
})
