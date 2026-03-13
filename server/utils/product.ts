import type {
  AcademicProductPublic,
  ProductWorkspaceDraftDTO,
  ProductReviewStatus,
  ProductType,
  ExtractedEntityWithEvidence,
  UploadedFileWorkspacePublic,
} from '~~/app/types'

type IdLike = string | { toString(): string }

interface ProductLike {
  _id: IdLike
  productType: ProductType
  owner: IdLike
  sourceFile: IdLike
  reviewStatus: ProductReviewStatus
  reviewConfirmedAt?: unknown
  extractedEntities?: {
    authors?: ExtractedEntityWithEvidence<string>[]
    title?: ExtractedEntityWithEvidence<string>
    institution?: ExtractedEntityWithEvidence<string>
    date?: ExtractedEntityWithEvidence<unknown>
    keywords?: ExtractedEntityWithEvidence<string>[]
    doi?: ExtractedEntityWithEvidence<string>
    eventOrJournal?: ExtractedEntityWithEvidence<string>
    extractionSource?: UploadedFileWorkspacePublic['ocrProvider']
    extractionConfidence?: number
    extractedAt?: unknown
  }
  manualMetadata?: {
    title?: string
    authors?: string[]
    institution?: string
    date?: unknown
    doi?: string
    keywords?: string[]
    notes?: string
  }
  isDeleted?: boolean
  deletedAt?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  // Article
  journalName?: string
  volume?: string
  issue?: string
  pages?: string | number
  issn?: string
  indexing?: string[]
  openAccess?: boolean
  articleType?: 'original' | 'revision' | 'corto' | 'carta' | 'otro'
  journalCountry?: string
  journalAbbreviation?: string
  publisher?: string
  areaOfKnowledge?: string
  language?: string
  license?: string
  // Conference paper
  eventName?: string
  eventCity?: string
  eventCountry?: string
  eventDate?: unknown
  presentationType?: 'oral' | 'poster' | 'workshop' | 'keynote'
  isbn?: string
  conferenceAcronym?: string
  conferenceNumber?: string
  proceedingsTitle?: string
  eventSponsor?: string
  // Thesis
  thesisLevel?: 'pregrado' | 'maestria' | 'especializacion' | 'doctorado'
  director?: string
  university?: string
  faculty?: string
  approvalDate?: unknown
  repositoryUrl?: string
  program?: string
  jurors?: string[]
  degreeGrantor?: string
  degreeName?: string
  modality?:
    | 'investigacion'
    | 'monografia'
    | 'proyecto_aplicado'
    | 'otro'
    | 'presencial'
    | 'virtual'
    | 'hibrida'
  projectCode?: string
  // Certificate
  issuingEntity?: string
  certificateType?: 'participacion' | 'ponente' | 'asistencia' | 'instructor' | 'otro'
  relatedEvent?: string
  issueDate?: unknown
  expirationDate?: unknown
  hours?: number
  location?: string
  // Research project
  fundingSource?: string
  startDate?: unknown
  endDate?: unknown
  projectStatus?: 'active' | 'completed' | 'suspended'
  coResearchers?: string[]
  principalInvestigatorName?: string
  institution?: string
  programOrCall?: string
  keywords?: string[]
  budget?: number
}

interface UploadedFileLike {
  _id: IdLike
  originalFilename: string
  productType?: ProductType
  mimeType: UploadedFileWorkspacePublic['mimeType']
  fileSizeBytes: number
  processingStatus: UploadedFileWorkspacePublic['processingStatus']
  processingError?: string | null
  rawExtractedText?: string | null
  ocrProvider?: UploadedFileWorkspacePublic['ocrProvider']
  ocrModel?: string | null
  ocrConfidence?: number | null
  nerProvider?: UploadedFileWorkspacePublic['nerProvider']
  nerModel?: string | null
  processingAttempt?: number | null
  processingStartedAt?: unknown
  ocrCompletedAt?: unknown
  nerStartedAt?: unknown
  processingCompletedAt?: unknown
  academicProductId?: IdLike
  reviewStatus?: ProductReviewStatus
  createdAt?: unknown
}

function toOptionalIsoString(value: unknown): string | undefined {
  if (!value) {
    return undefined
  }

  return new Date(value as string | Date).toISOString()
}

function toId(value: IdLike | null | undefined): string {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'toString' in value) {
    return value.toString()
  }

  return ''
}

export function toAcademicProductPublic(product: ProductLike): AcademicProductPublic {
  return {
    _id: toId(product._id),
    productType: product.productType,
    owner: toId(product.owner),
    sourceFile: toId(product.sourceFile),
    reviewStatus: product.reviewStatus,
    reviewConfirmedAt: toOptionalIsoString(product.reviewConfirmedAt),
    extractedEntities: {
      authors: product.extractedEntities?.authors ?? [],
      title: product.extractedEntities?.title ?? undefined,
      institution: product.extractedEntities?.institution ?? undefined,
      date: product.extractedEntities?.date?.value
        ? {
            value: toOptionalIsoString(product.extractedEntities.date.value) as string,
            confidence: product.extractedEntities.date.confidence,
            anchors: product.extractedEntities.date.anchors ?? [],
          }
        : undefined,
      keywords: product.extractedEntities?.keywords ?? [],
      doi: product.extractedEntities?.doi ?? undefined,
      eventOrJournal: product.extractedEntities?.eventOrJournal ?? undefined,
      extractionSource: product.extractedEntities?.extractionSource ?? 'pdfjs_native',
      extractionConfidence: product.extractedEntities?.extractionConfidence ?? 0,
      extractedAt:
        toOptionalIsoString(product.extractedEntities?.extractedAt) ?? new Date().toISOString(),
    },
    manualMetadata: {
      title: product.manualMetadata?.title ?? undefined,
      authors: product.manualMetadata?.authors ?? [],
      institution: product.manualMetadata?.institution ?? undefined,
      date: toOptionalIsoString(product.manualMetadata?.date),
      doi: product.manualMetadata?.doi ?? undefined,
      keywords: product.manualMetadata?.keywords ?? [],
      notes: product.manualMetadata?.notes ?? undefined,
    },
    isDeleted: Boolean(product.isDeleted),
    deletedAt: toOptionalIsoString(product.deletedAt),
    createdAt: toOptionalIsoString(product.createdAt) ?? new Date().toISOString(),
    updatedAt: toOptionalIsoString(product.updatedAt) ?? new Date().toISOString(),
    journalName: product.journalName,
    volume: product.volume,
    issue: product.issue,
    pages: product.pages != null ? String(product.pages) : undefined,
    issn: product.issn,
    indexing: product.indexing,
    openAccess: product.openAccess,
    articleType: product.articleType,
    journalCountry: product.journalCountry,
    journalAbbreviation: product.journalAbbreviation,
    publisher: product.publisher,
    areaOfKnowledge: product.areaOfKnowledge,
    language: product.language,
    license: product.license,
    thesisLevel: product.thesisLevel,
    director: product.director,
    university: product.university,
    faculty: product.faculty,
    approvalDate: toOptionalIsoString(product.approvalDate),
    repositoryUrl: product.repositoryUrl,
    program: product.program,
    jurors: product.jurors,
    degreeGrantor: product.degreeGrantor,
    degreeName: product.degreeName,
    projectCode: product.projectCode,
    thesisAreaOfKnowledge: product.productType === 'thesis' ? product.areaOfKnowledge : undefined,
    thesisModality:
      product.productType === 'thesis'
        ? (product.modality as AcademicProductPublic['thesisModality'])
        : undefined,
    thesisLanguage: product.productType === 'thesis' ? product.language : undefined,
    thesisPages:
      product.productType === 'thesis' && product.pages != null ? String(product.pages) : undefined,
    eventName: product.eventName,
    eventCity: product.eventCity,
    eventCountry: product.eventCountry,
    eventDate: toOptionalIsoString(product.eventDate),
    presentationType: product.presentationType,
    isbn: product.isbn,
    conferenceAcronym: product.conferenceAcronym,
    conferenceNumber: product.conferenceNumber,
    proceedingsTitle: product.proceedingsTitle,
    eventSponsor: product.eventSponsor,
    conferenceAreaOfKnowledge:
      product.productType === 'conference_paper' ? product.areaOfKnowledge : undefined,
    conferenceLanguage: product.productType === 'conference_paper' ? product.language : undefined,
    conferencePages:
      product.productType === 'conference_paper' && product.pages != null
        ? String(product.pages)
        : undefined,
    issuingEntity: product.issuingEntity,
    certificateType: product.certificateType,
    relatedEvent: product.relatedEvent,
    issueDate: toOptionalIsoString(product.issueDate),
    expirationDate: toOptionalIsoString(product.expirationDate),
    hours: product.hours,
    location: product.location,
    certificateModality:
      product.productType === 'certificate'
        ? (product.modality as AcademicProductPublic['certificateModality'])
        : undefined,
    certificateAreaOfKnowledge:
      product.productType === 'certificate' ? product.areaOfKnowledge : undefined,
    fundingSource: product.fundingSource,
    startDate: toOptionalIsoString(product.startDate),
    endDate: toOptionalIsoString(product.endDate),
    projectStatus: product.projectStatus,
    coResearchers: product.coResearchers,
    principalInvestigatorName: product.principalInvestigatorName,
    programOrCall: product.programOrCall,
    researchProjectInstitution:
      product.productType === 'research_project' ? product.institution : undefined,
    researchProjectAreaOfKnowledge:
      product.productType === 'research_project' ? product.areaOfKnowledge : undefined,
    researchProjectKeywords:
      product.productType === 'research_project' ? product.keywords : undefined,
    budget: product.budget,
  }
}

export function toUploadedFileWorkspacePublic(
  uploadedFile: UploadedFileLike,
): UploadedFileWorkspacePublic {
  return {
    _id: toId(uploadedFile._id),
    originalFilename: uploadedFile.originalFilename,
    productType: uploadedFile.productType ?? undefined,
    mimeType: uploadedFile.mimeType,
    fileSizeBytes: uploadedFile.fileSizeBytes,
    processingStatus: uploadedFile.processingStatus,
    processingError: uploadedFile.processingError ?? undefined,
    rawExtractedText: uploadedFile.rawExtractedText ?? undefined,
    ocrProvider: uploadedFile.ocrProvider ?? undefined,
    ocrModel: uploadedFile.ocrModel ?? undefined,
    ocrConfidence: uploadedFile.ocrConfidence ?? undefined,
    nerProvider: uploadedFile.nerProvider ?? undefined,
    nerModel: uploadedFile.nerModel ?? undefined,
    processingAttempt: uploadedFile.processingAttempt ?? 0,
    processingStartedAt: toOptionalIsoString(uploadedFile.processingStartedAt),
    ocrCompletedAt: toOptionalIsoString(uploadedFile.ocrCompletedAt),
    nerStartedAt: toOptionalIsoString(uploadedFile.nerStartedAt),
    processingCompletedAt: toOptionalIsoString(uploadedFile.processingCompletedAt),
    academicProductId: uploadedFile.academicProductId
      ? toId(uploadedFile.academicProductId)
      : undefined,
    reviewStatus: uploadedFile.reviewStatus ?? undefined,
    createdAt: toOptionalIsoString(uploadedFile.createdAt) ?? new Date().toISOString(),
  }
}

export function buildProductWorkspaceDraft(
  product: ProductLike,
  uploadedFile: UploadedFileLike,
): ProductWorkspaceDraftDTO {
  return {
    product: toAcademicProductPublic(product),
    uploadedFile: toUploadedFileWorkspacePublic({
      ...uploadedFile,
      productType: uploadedFile.productType ?? product.productType,
      academicProductId: product._id,
      reviewStatus: product.reviewStatus,
    }),
  }
}
