import mongoose from 'mongoose'
import { PRODUCT_REVIEW_STATUSES, PRODUCT_TYPES, type IAcademicProduct } from '~~/app/types'

const { Schema, model, models } = mongoose

const documentAnchorSchema = new Schema(
  {
    page: { type: Number, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    confidence: { type: Number, required: true },
    sourceText: { type: String },
    provider: {
      type: String,
      enum: ['pdfjs_native', 'gemini_vision', 'mistral_ocr_3'],
      required: true,
    },
  },
  { _id: false },
)

const stringEvidenceSchema = new Schema(
  {
    value: { type: String, trim: true },
    confidence: { type: Number, default: 0 },
    anchors: { type: [documentAnchorSchema], default: [] },
  },
  { _id: false },
)

const dateEvidenceSchema = new Schema(
  {
    value: { type: Date },
    confidence: { type: Number, default: 0 },
    anchors: { type: [documentAnchorSchema], default: [] },
  },
  { _id: false },
)

const extractedEntitiesSchema = new Schema(
  {
    authors: { type: [stringEvidenceSchema], default: [] },
    title: { type: stringEvidenceSchema },
    institution: { type: stringEvidenceSchema },
    date: { type: dateEvidenceSchema },
    keywords: { type: [stringEvidenceSchema], default: [] },
    doi: { type: stringEvidenceSchema },
    eventOrJournal: { type: stringEvidenceSchema },
    extractionSource: {
      type: String,
      required: true,
      enum: ['pdfjs_native', 'gemini_vision', 'mistral_ocr_3'],
    },
    extractionConfidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    extractedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
)

const manualMetadataSchema = new Schema(
  {
    title: { type: String, trim: true },
    authors: { type: [String], default: [] },
    institution: { type: String, trim: true },
    date: { type: Date, default: null },
    doi: { type: String, trim: true },
    keywords: { type: [String], default: [] },
    notes: { type: String, maxlength: 2000 },
  },
  { _id: false },
)

const academicProductSchema = new Schema<IAcademicProduct>(
  {
    productType: {
      type: String,
      required: true,
      enum: [...PRODUCT_TYPES],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El producto debe estar asociado a un usuario'],
    },
    sourceFile: {
      type: Schema.Types.ObjectId,
      ref: 'UploadedFile',
      required: [true, 'El producto debe tener un archivo fuente'],
    },
    reviewStatus: {
      type: String,
      enum: [...PRODUCT_REVIEW_STATUSES],
      default: 'draft',
      required: true,
    },
    reviewConfirmedAt: {
      type: Date,
      default: null,
    },
    extractedEntities: {
      type: extractedEntitiesSchema,
      required: true,
    },
    manualMetadata: {
      type: manualMetadataSchema,
      default: () => ({ authors: [], keywords: [] }),
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
    discriminatorKey: 'productType',
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v
        return ret
      },
    },
  },
)

academicProductSchema.index(
  { owner: 1, productType: 1, isDeleted: 1, createdAt: -1 },
  { name: 'idx_owner_type' },
)
academicProductSchema.index(
  { owner: 1, reviewStatus: 1, isDeleted: 1, createdAt: -1 },
  { name: 'idx_owner_review_status' },
)
academicProductSchema.index(
  { 'manualMetadata.date': -1, productType: 1 },
  { name: 'idx_date_type' },
)
academicProductSchema.index(
  {
    'manualMetadata.title': 'text',
    'manualMetadata.keywords': 'text',
    'manualMetadata.authors': 'text',
  },
  {
    name: 'idx_fulltext_search',
    default_language: 'spanish',
    weights: {
      'manualMetadata.title': 10,
      'manualMetadata.authors': 5,
      'manualMetadata.keywords': 3,
    },
  },
)
academicProductSchema.index({ sourceFile: 1 }, { unique: true, name: 'ux_source_file' })

const articleSchema = new Schema({
  journalName: { type: String, trim: true },
  volume: { type: String, trim: true },
  issue: { type: String, trim: true },
  pages: {
    type: String,
    trim: true,
    match: [/^\d+(-\d+)?$/, 'Formato de páginas inválido'],
  },
  issn: { type: String, trim: true },
  indexing: {
    type: [String],
    default: [],
    validate: {
      validator: (values: string[]) => values.length <= 10,
      message: 'Máximo 10 indexaciones por artículo',
    },
  },
  openAccess: { type: Boolean, default: false },
  articleType: {
    type: String,
    enum: ['original', 'revision', 'corto', 'carta', 'otro'],
  },
  journalCountry: { type: String, trim: true },
  journalAbbreviation: { type: String, trim: true },
  publisher: { type: String, trim: true },
  areaOfKnowledge: { type: String, trim: true },
  language: { type: String, trim: true },
  license: { type: String, trim: true },
})

const conferencePaperSchema = new Schema({
  eventName: { type: String, trim: true },
  eventCity: { type: String, trim: true },
  eventCountry: { type: String, trim: true },
  eventDate: { type: Date, default: null },
  presentationType: {
    type: String,
    enum: ['oral', 'poster', 'workshop', 'keynote'],
  },
  isbn: { type: String, trim: true },
  conferenceAcronym: { type: String, trim: true },
  conferenceNumber: { type: String, trim: true },
  proceedingsTitle: { type: String, trim: true },
  publisher: { type: String, trim: true },
  pages: {
    type: String,
    trim: true,
    match: [/^\d+(-\d+)?$/, 'Formato de páginas inválido'],
  },
  eventSponsor: { type: String, trim: true },
  areaOfKnowledge: { type: String, trim: true },
  language: { type: String, trim: true },
})

const thesisSchema = new Schema({
  thesisLevel: {
    type: String,
    enum: ['pregrado', 'maestria', 'especializacion', 'doctorado'],
  },
  director: { type: String, trim: true },
  university: { type: String, trim: true },
  faculty: { type: String, trim: true },
  approvalDate: { type: Date, default: null },
  repositoryUrl: {
    type: String,
    trim: true,
    match: [/^https?:\/\//, 'La URL del repositorio debe iniciar con http(s)://'],
  },
  program: { type: String, trim: true },
  jurors: { type: [String], default: [] },
  degreeGrantor: { type: String, trim: true },
  degreeName: { type: String, trim: true },
  areaOfKnowledge: { type: String, trim: true },
  modality: {
    type: String,
    enum: ['investigacion', 'monografia', 'proyecto_aplicado', 'otro'],
  },
  language: { type: String, trim: true },
  pages: { type: Number, min: 1 },
  projectCode: { type: String, trim: true },
})

const certificateSchema = new Schema({
  issuingEntity: { type: String, trim: true },
  certificateType: {
    type: String,
    enum: ['participacion', 'ponente', 'asistencia', 'instructor', 'otro'],
  },
  relatedEvent: { type: String, trim: true },
  issueDate: { type: Date, default: null },
  expirationDate: { type: Date, default: null },
  hours: { type: Number, min: 0 },
  location: { type: String, trim: true },
  modality: {
    type: String,
    enum: ['presencial', 'virtual', 'hibrida'],
  },
  areaOfKnowledge: { type: String, trim: true },
  projectCode: { type: String, trim: true },
})

const researchProjectSchema = new Schema({
  projectCode: { type: String, trim: true },
  fundingSource: { type: String, trim: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  projectStatus: {
    type: String,
    enum: ['active', 'completed', 'suspended'],
  },
  coResearchers: { type: [String], default: [] },
  principalInvestigatorName: { type: String, trim: true },
  institution: { type: String, trim: true },
  programOrCall: { type: String, trim: true },
  areaOfKnowledge: { type: String, trim: true },
  keywords: { type: [String], default: [] },
  budget: { type: Number, min: 0 },
})

const AcademicProduct =
  (models.AcademicProduct as mongoose.Model<IAcademicProduct> | undefined) ||
  model<IAcademicProduct>('AcademicProduct', academicProductSchema)

if (!AcademicProduct.discriminators?.article) {
  AcademicProduct.discriminator('article', articleSchema)
}
if (!AcademicProduct.discriminators?.conference_paper) {
  AcademicProduct.discriminator('conference_paper', conferencePaperSchema)
}
if (!AcademicProduct.discriminators?.thesis) {
  AcademicProduct.discriminator('thesis', thesisSchema)
}
if (!AcademicProduct.discriminators?.certificate) {
  AcademicProduct.discriminator('certificate', certificateSchema)
}
if (!AcademicProduct.discriminators?.research_project) {
  AcademicProduct.discriminator('research_project', researchProjectSchema)
}

export default AcademicProduct
