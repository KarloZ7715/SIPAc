import { Readable } from 'node:stream'
import mongoose, { Types } from 'mongoose'
import type { DatabaseId } from '~~/app/types'

const GRIDFS_BUCKET_NAME = 'uploads'

interface UploadToGridFsInput {
  buffer: Buffer
  filename: string
  contentType: string
  metadata?: Record<string, unknown>
}

function getUploadsBucket() {
  const db = mongoose.connection.db

  if (!db || mongoose.connection.readyState !== 1) {
    throw new Error('La conexión a MongoDB no está disponible para GridFS')
  }

  return new mongoose.mongo.GridFSBucket(db, { bucketName: GRIDFS_BUCKET_NAME })
}

function toObjectId(value: string | Types.ObjectId | DatabaseId) {
  if (value instanceof Types.ObjectId) {
    return value
  }

  return new Types.ObjectId(value.toString())
}

export async function uploadBufferToGridFs(input: UploadToGridFsInput): Promise<Types.ObjectId> {
  const bucket = getUploadsBucket()

  return await new Promise<Types.ObjectId>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(input.filename, {
      metadata: {
        contentType: input.contentType,
        ...input.metadata,
      },
    })

    uploadStream.on('error', reject)
    uploadStream.on('finish', () => {
      resolve(uploadStream.id as Types.ObjectId)
    })

    Readable.from(input.buffer).pipe(uploadStream)
  })
}

export async function deleteFileFromGridFs(
  fileId: string | Types.ObjectId | DatabaseId,
): Promise<void> {
  const bucket = getUploadsBucket()
  await bucket.delete(toObjectId(fileId))
}

export async function findGridFsFile(fileId: string | Types.ObjectId | DatabaseId) {
  const bucket = getUploadsBucket()
  const files = await bucket
    .find({ _id: toObjectId(fileId) })
    .limit(1)
    .toArray()
  return files[0] ?? null
}

export function openGridFsDownloadStream(fileId: string | Types.ObjectId | DatabaseId) {
  const bucket = getUploadsBucket()
  return bucket.openDownloadStream(toObjectId(fileId))
}

export async function readGridFsFileToBuffer(
  fileId: string | Types.ObjectId | DatabaseId,
): Promise<Buffer> {
  const downloadStream = openGridFsDownloadStream(fileId)

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []

    downloadStream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    downloadStream.on('error', reject)
    downloadStream.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
  })
}
