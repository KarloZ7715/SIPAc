/**
 * Migración one-shot: segmentIndex + índice compuesto (sourceFile + segmentIndex).
 * Ejecutar con: node scripts/migrate-academic-product-segments.mjs
 * Requiere MONGODB_URI en el entorno.
 */
import mongoose from 'mongoose'

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('MONGODB_URI es requerido')
  process.exit(1)
}

const COLLECTION = 'academicproducts'

async function main() {
  await mongoose.connect(uri)
  const db = mongoose.connection.db
  const col = db.collection(COLLECTION)

  try {
    await col.dropIndex('ux_source_file')
    console.log('Dropped index ux_source_file')
  } catch (e) {
    if (e.code !== 27 && e.codeName !== 'IndexNotFound') {
      throw e
    }
    console.log('Index ux_source_file not found (ok)')
  }

  const backfill = await col.updateMany(
    { segmentIndex: { $exists: false } },
    { $set: { segmentIndex: 0 } },
  )
  console.log('Backfill segmentIndex:', backfill.modifiedCount, 'modified')

  try {
    await col.dropIndex('ux_source_file_segment')
    console.log('Dropped existing ux_source_file_segment if any')
  } catch (e) {
    if (e.code !== 27 && e.codeName !== 'IndexNotFound') {
      throw e
    }
  }

  await col.createIndex(
    { sourceFile: 1, segmentIndex: 1 },
    {
      unique: true,
      name: 'ux_source_file_segment',
      partialFilterExpression: { isDeleted: false },
    },
  )
  console.log('Created partial unique index ux_source_file_segment')

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
