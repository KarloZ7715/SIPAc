import type { DatabaseId } from './database'
import type { OcrProvider, UploadedFileWorkspacePublic } from './uploaded-file'
import type { ExtractedEntityWithEvidence } from './document-geometry'

export const PRODUCT_TYPES = [
  'article',
  'conference_paper',
  'thesis',
  'certificate',
  'research_project',
] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

export const PRODUCT_REVIEW_STATUSES = ['draft', 'confirmed'] as const
export type ProductReviewStatus = (typeof PRODUCT_REVIEW_STATUSES)[number]

export interface IExtractedEntities {
  authors: ExtractedEntityWithEvidence<string>[]
  title?: ExtractedEntityWithEvidence<string>
  institution?: ExtractedEntityWithEvidence<string>
  date?: ExtractedEntityWithEvidence<Date>
  keywords: ExtractedEntityWithEvidence<string>[]
  doi?: ExtractedEntityWithEvidence<string>
  eventOrJournal?: ExtractedEntityWithEvidence<string>
  extractionSource: OcrProvider
  extractionConfidence: number
  extractedAt: Date
}

export interface IManualMetadata {
  title?: string
  authors: string[]
  institution?: string
  date?: Date
  doi?: string
  keywords: string[]
  notes?: string
}

export interface IAcademicProduct {
  _id: DatabaseId
  productType: ProductType
  owner: DatabaseId
  sourceFile: DatabaseId
  reviewStatus: ProductReviewStatus
  reviewConfirmedAt?: Date
  extractedEntities: IExtractedEntities
  manualMetadata: IManualMetadata
  isDeleted: boolean
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// --- Discriminator subtypes ---

export interface IArticle extends IAcademicProduct {
  journalName?: string
  volume?: string
  issue?: string
  pages?: string
  issn?: string
  indexing: string[]
  openAccess: boolean
  articleType?: 'original' | 'revision' | 'corto' | 'carta' | 'otro'
  journalCountry?: string
  journalAbbreviation?: string
  publisher?: string
  areaOfKnowledge?: string
  language?: string
  license?: string
}

export interface IConferencePaper extends IAcademicProduct {
  eventName?: string
  eventCity?: string
  eventCountry?: string
  eventDate?: Date
  presentationType?: 'oral' | 'poster' | 'workshop' | 'keynote'
  isbn?: string
  conferenceAcronym?: string
  conferenceNumber?: string
  proceedingsTitle?: string
  publisher?: string
  pages?: string
  eventSponsor?: string
  areaOfKnowledge?: string
  language?: string
}

export interface IThesis extends IAcademicProduct {
  thesisLevel?: 'pregrado' | 'maestria' | 'especializacion' | 'doctorado'
  director?: string
  university?: string
  faculty?: string
  approvalDate?: Date
  repositoryUrl?: string
  program?: string
  jurors?: string[]
  degreeGrantor?: string
  degreeName?: string
  areaOfKnowledge?: string
  modality?: 'investigacion' | 'monografia' | 'proyecto_aplicado' | 'otro'
  language?: string
  pages?: number
  projectCode?: string
}

export interface ICertificate extends IAcademicProduct {
  issuingEntity?: string
  certificateType?: 'participacion' | 'ponente' | 'asistencia' | 'instructor' | 'otro'
  relatedEvent?: string
  issueDate?: Date
  expirationDate?: Date
  hours?: number
  location?: string
  modality?: 'presencial' | 'virtual' | 'hibrida'
  areaOfKnowledge?: string
  projectCode?: string
}

export interface IResearchProject extends IAcademicProduct {
  projectCode?: string
  fundingSource?: string
  startDate?: Date
  endDate?: Date
  projectStatus?: 'active' | 'completed' | 'suspended'
  coResearchers: string[]
  principalInvestigatorName?: string
  institution?: string
  programOrCall?: string
  areaOfKnowledge?: string
  keywords?: string[]
  budget?: number
}

export interface ExtractedEntitiesPublic {
  authors: ExtractedEntityWithEvidence<string>[]
  title?: ExtractedEntityWithEvidence<string>
  institution?: ExtractedEntityWithEvidence<string>
  date?: ExtractedEntityWithEvidence<string>
  keywords: ExtractedEntityWithEvidence<string>[]
  doi?: ExtractedEntityWithEvidence<string>
  eventOrJournal?: ExtractedEntityWithEvidence<string>
  extractionSource: OcrProvider
  extractionConfidence: number
  extractedAt: string
}

export interface ManualMetadataPublic {
  title?: string
  authors: string[]
  institution?: string
  date?: string
  doi?: string
  keywords: string[]
  notes?: string
}

export interface AcademicProductPublic {
  _id: string
  productType: ProductType
  owner: string
  sourceFile: string
  reviewStatus: ProductReviewStatus
  reviewConfirmedAt?: string
  extractedEntities: ExtractedEntitiesPublic
  manualMetadata: ManualMetadataPublic
  isDeleted: boolean
  deletedAt?: string
  createdAt: string
  updatedAt: string
  // Article-specific public fields
  journalName?: string
  volume?: string
  issue?: string
  pages?: string
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
  // Thesis-specific public fields
  thesisLevel?: 'pregrado' | 'maestria' | 'especializacion' | 'doctorado'
  director?: string
  university?: string
  faculty?: string
  approvalDate?: string
  repositoryUrl?: string
  program?: string
  jurors?: string[]
  degreeGrantor?: string
  degreeName?: string
  projectCode?: string
  thesisAreaOfKnowledge?: string
  thesisModality?: 'investigacion' | 'monografia' | 'proyecto_aplicado' | 'otro'
  thesisLanguage?: string
  thesisPages?: string
  // Conference paper-specific public fields
  eventName?: string
  eventCity?: string
  eventCountry?: string
  eventDate?: string
  presentationType?: 'oral' | 'poster' | 'workshop' | 'keynote'
  isbn?: string
  conferenceAcronym?: string
  conferenceNumber?: string
  proceedingsTitle?: string
  eventSponsor?: string
  conferenceAreaOfKnowledge?: string
  conferenceLanguage?: string
  conferencePages?: string
  // Certificate-specific public fields
  issuingEntity?: string
  certificateType?: 'participacion' | 'ponente' | 'asistencia' | 'instructor' | 'otro'
  relatedEvent?: string
  issueDate?: string
  expirationDate?: string
  hours?: number
  location?: string
  certificateModality?: 'presencial' | 'virtual' | 'hibrida'
  certificateAreaOfKnowledge?: string
  // Research project-specific public fields
  fundingSource?: string
  startDate?: string
  endDate?: string
  projectStatus?: 'active' | 'completed' | 'suspended'
  coResearchers?: string[]
  principalInvestigatorName?: string
  programOrCall?: string
  researchProjectInstitution?: string
  researchProjectAreaOfKnowledge?: string
  researchProjectKeywords?: string[]
  budget?: number
}

export type ProductReviewAction = 'save-draft' | 'confirm'

export interface UpdateAcademicProductDTO {
  manualMetadata?: ManualMetadataPublic
  action?: ProductReviewAction
  productType?: ProductType
  article?: {
    journalName?: string
    volume?: string
    issue?: string
    pages?: string
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
  }
  thesis?: {
    thesisLevel?: 'pregrado' | 'maestria' | 'especializacion' | 'doctorado'
    director?: string
    university?: string
    faculty?: string
    approvalDate?: string
    repositoryUrl?: string
    program?: string
    jurors?: string[]
    degreeGrantor?: string
    degreeName?: string
    areaOfKnowledge?: string
    modality?: 'investigacion' | 'monografia' | 'proyecto_aplicado' | 'otro'
    language?: string
    pages?: number
    projectCode?: string
  }
  conferencePaper?: {
    eventName?: string
    eventCity?: string
    eventCountry?: string
    eventDate?: string
    presentationType?: 'oral' | 'poster' | 'workshop' | 'keynote'
    isbn?: string
    conferenceAcronym?: string
    conferenceNumber?: string
    proceedingsTitle?: string
    publisher?: string
    pages?: string
    eventSponsor?: string
    areaOfKnowledge?: string
    language?: string
  }
  certificate?: {
    issuingEntity?: string
    certificateType?: 'participacion' | 'ponente' | 'asistencia' | 'instructor' | 'otro'
    relatedEvent?: string
    issueDate?: string
    expirationDate?: string
    hours?: number
    location?: string
    modality?: 'presencial' | 'virtual' | 'hibrida'
    areaOfKnowledge?: string
    projectCode?: string
  }
  researchProject?: {
    projectCode?: string
    fundingSource?: string
    startDate?: string
    endDate?: string
    projectStatus?: 'active' | 'completed' | 'suspended'
    coResearchers?: string[]
    principalInvestigatorName?: string
    institution?: string
    programOrCall?: string
    areaOfKnowledge?: string
    keywords?: string[]
    budget?: number
  }
}

export interface ProductWorkspaceDraftDTO {
  product: AcademicProductPublic
  uploadedFile: UploadedFileWorkspacePublic
}
