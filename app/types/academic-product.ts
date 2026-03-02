import { type Types } from 'mongoose'
import { type OcrProvider } from './uploaded-file'

export const PRODUCT_TYPES = [
  'article',
  'conference_paper',
  'thesis',
  'certificate',
  'research_project',
] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

export const VERIFICATION_STATUSES = ['pending_review', 'verified', 'rejected'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export interface IExtractedEntities {
  authors: string[]
  title?: string
  institution?: string
  date?: Date
  keywords: string[]
  doi?: string
  eventOrJournal?: string
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
  _id: Types.ObjectId
  productType: ProductType
  owner: Types.ObjectId
  sourceFile: Types.ObjectId
  verificationStatus: VerificationStatus
  verifiedBy?: Types.ObjectId
  verificationDate?: Date
  rejectionReason?: string
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
}

export interface IConferencePaper extends IAcademicProduct {
  eventName?: string
  eventCity?: string
  eventCountry?: string
  eventDate?: Date
  presentationType?: 'oral' | 'poster' | 'workshop' | 'keynote'
  isbn?: string
}

export interface IThesis extends IAcademicProduct {
  thesisLevel?: 'maestria' | 'especializacion' | 'doctorado'
  director?: string
  university?: string
  faculty?: string
  approvalDate?: Date
  repositoryUrl?: string
}

export interface ICertificate extends IAcademicProduct {
  issuingEntity?: string
  certificateType?: 'participacion' | 'ponente' | 'asistencia' | 'instructor' | 'otro'
  relatedEvent?: string
  issueDate?: Date
  expirationDate?: Date
  hours?: number
}

export interface IResearchProject extends IAcademicProduct {
  projectCode?: string
  fundingSource?: string
  startDate?: Date
  endDate?: Date
  projectStatus?: 'active' | 'completed' | 'suspended'
  coResearchers: string[]
}
