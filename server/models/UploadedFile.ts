import mongoose from 'mongoose'
import {
  ALLOWED_MIME_TYPES,
  CONTENT_DIGEST_ALGORITHMS,
  DOCUMENT_CLASSIFICATIONS,
  MAX_FILE_SIZE_BYTES,
  NER_PROVIDERS,
  OCR_PROVIDERS,
  PROCESSING_STATUSES,
  PRODUCT_TYPES,
  type IUploadedFile,
} from '~~/app/types'

const { Schema, model, models } = mongoose
const NER_ATTEMPT_ERROR_MESSAGE_MAX_LENGTH = 280

const fileContentDigestSchema = new Schema(
  {
    algorithm: {
      type: String,
      enum: [...CONTENT_DIGEST_ALGORITHMS],
      required: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      minlength: 64,
      maxlength: 64,
    },
  },
  { _id: false },
)

const uploadedFileSchema = new Schema<IUploadedFile>(
  {
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El archivo debe estar asociado a un usuario'],
      index: true,
    },
    originalFilename: {
      type: String,
      required: [true, 'El nombre original del archivo es obligatorio'],
      trim: true,
      maxlength: [255, 'El nombre del archivo no puede superar los 255 caracteres'],
    },
    gridfsFileId: {
      type: Schema.Types.ObjectId,
      required: [true, 'El archivo debe tener una referencia GridFS'],
    },
    productType: {
      type: String,
      default: null,
      enum: {
        values: [...PRODUCT_TYPES],
        message: 'El tipo de producto {VALUE} no es válido',
      },
    },
    nerForceSingleDocument: {
      type: Boolean,
      default: false,
    },
    sourceWorkCount: {
      type: Number,
      min: 0,
      default: null,
    },
    mimeType: {
      type: String,
      required: [true, 'El tipo MIME es obligatorio'],
      enum: {
        values: [...ALLOWED_MIME_TYPES],
        message: 'Tipo MIME {VALUE} no permitido',
      },
    },
    fileSizeBytes: {
      type: Number,
      required: [true, 'El tamaño del archivo es obligatorio'],
      max: [MAX_FILE_SIZE_BYTES, 'El archivo no puede superar los 20 MB'],
    },
    contentDigest: {
      type: fileContentDigestSchema,
      default: null,
    },
    processingStatus: {
      type: String,
      enum: [...PROCESSING_STATUSES],
      default: 'pending',
    },
    processingError: {
      type: String,
      default: null,
    },
    rawExtractedText: {
      type: String,
      default: null,
    },
    ocrProvider: {
      type: String,
      enum: [...OCR_PROVIDERS],
      default: null,
    },
    ocrModel: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    ocrConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    nerProvider: {
      type: String,
      enum: [...NER_PROVIDERS],
      default: null,
    },
    nerModel: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    nerAttemptTrace: {
      type: [
        {
          _id: false,
          scope: {
            type: String,
            enum: ['extraction_first_pass', 'extraction_second_pass'],
            required: true,
          },
          attempt: {
            type: Number,
            min: 1,
            required: true,
          },
          provider: {
            type: String,
            enum: [...NER_PROVIDERS],
            required: true,
          },
          modelId: {
            type: String,
            trim: true,
            maxlength: 120,
            required: true,
          },
          status: {
            type: String,
            enum: ['succeeded', 'failed'],
            required: true,
          },
          durationMs: {
            type: Number,
            min: 0,
            required: true,
          },
          errorType: {
            type: String,
            trim: true,
            maxlength: 80,
            default: null,
          },
          errorMessage: {
            type: String,
            trim: true,
            maxlength: 280,
            default: null,
          },
        },
      ],
      default: [],
    },
    documentClassification: {
      type: String,
      enum: [...DOCUMENT_CLASSIFICATIONS],
      default: 'uncertain',
    },
    documentClassificationSource: {
      type: String,
      enum: ['heuristic', 'llm', 'hybrid'],
      default: null,
    },
    classificationConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    classificationRationale: {
      type: String,
      trim: true,
      maxlength: 240,
      default: null,
    },
    processingAttempt: {
      type: Number,
      min: 0,
      default: 0,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    ocrCompletedAt: {
      type: Date,
      default: null,
    },
    nerStartedAt: {
      type: Date,
      default: null,
    },
    processingCompletedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v
        return ret
      },
    },
  },
)

uploadedFileSchema.index({ uploadedBy: 1, isDeleted: 1, createdAt: -1 }, { name: 'idx_user_files' })
uploadedFileSchema.index(
  { processingStatus: 1 },
  {
    partialFilterExpression: { processingStatus: { $in: ['pending', 'processing'] } },
    name: 'idx_processing_queue',
  },
)

uploadedFileSchema.index(
  { 'contentDigest.value': 1 },
  {
    unique: true,
    partialFilterExpression: {
      processingStatus: 'completed',
      isDeleted: false,
      'contentDigest.value': { $exists: true, $type: 'string' },
    },
    name: 'idx_unique_content_digest_completed_active',
  },
)

uploadedFileSchema.pre('validate', function sanitizeLegacyNerAttemptTrace() {
  const nerAttemptTrace = this.get('nerAttemptTrace')
  if (!Array.isArray(nerAttemptTrace) || nerAttemptTrace.length === 0) {
    return
  }

  this.set(
    'nerAttemptTrace',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nerAttemptTrace.map((entry: any) => {
      if (!entry?.errorMessage || typeof entry.errorMessage !== 'string') {
        return entry
      }

      const compact = entry.errorMessage.replace(/\s+/g, ' ').trim()
      if (compact.length <= NER_ATTEMPT_ERROR_MESSAGE_MAX_LENGTH) {
        return {
          ...entry,
          errorMessage: compact,
        }
      }

      return {
        ...entry,
        errorMessage: `${compact.slice(0, NER_ATTEMPT_ERROR_MESSAGE_MAX_LENGTH - 3)}...`,
      }
    }),
  )
})

const UploadedFileModel =
  (models.UploadedFile as mongoose.Model<IUploadedFile> | undefined) ||
  model<IUploadedFile>('UploadedFile', uploadedFileSchema)

export default UploadedFileModel
