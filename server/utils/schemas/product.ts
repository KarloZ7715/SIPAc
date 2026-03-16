import { z } from 'zod'
import { PRODUCT_TYPES } from '~~/app/types'

export const productReviewActionSchema = z.enum(['save-draft', 'confirm'])

export const manualMetadataSchema = z.object({
  title: z.string().trim().optional(),
  authors: z.array(z.string().trim()).default([]),
  institution: z.string().trim().optional(),
  date: z.coerce.date().optional(),
  doi: z.string().trim().optional(),
  keywords: z.array(z.string().trim()).default([]),
  notes: z.string().max(2000, 'Las notas no pueden superar los 2000 caracteres').optional(),
})

const articleUpdateSchema = z
  .object({
    journalName: z.string().trim().optional(),
    volume: z.string().trim().optional(),
    issue: z.string().trim().optional(),
    pages: z
      .string()
      .trim()
      .regex(/^\d+(-\d+)?$/, 'Formato de páginas inválido')
      .optional(),
    issn: z.string().trim().optional(),
    indexing: z.array(z.string().trim()).max(10).optional(),
    openAccess: z.boolean().optional(),
    articleType: z.enum(['original', 'revision', 'corto', 'carta', 'otro']).optional(),
    journalCountry: z.string().trim().optional(),
    journalAbbreviation: z.string().trim().optional(),
    publisher: z.string().trim().optional(),
    areaOfKnowledge: z.string().trim().optional(),
    language: z.string().trim().optional(),
    license: z.string().trim().optional(),
  })
  .partial()

const thesisUpdateSchema = z
  .object({
    thesisLevel: z.enum(['pregrado', 'maestria', 'especializacion', 'doctorado']).optional(),
    director: z.string().trim().optional(),
    university: z.string().trim().optional(),
    faculty: z.string().trim().optional(),
    approvalDate: z.coerce.date().optional(),
    repositoryUrl: z.string().trim().url('La URL del repositorio debe ser válida').optional(),
    program: z.string().trim().optional(),
    jurors: z.array(z.string().trim()).optional(),
    degreeGrantor: z.string().trim().optional(),
    degreeName: z.string().trim().optional(),
    areaOfKnowledge: z.string().trim().optional(),
    modality: z.enum(['investigacion', 'monografia', 'proyecto_aplicado', 'otro']).optional(),
    language: z.string().trim().optional(),
    pages: z.coerce.number().int().positive().optional(),
    projectCode: z.string().trim().optional(),
  })
  .partial()

const conferencePaperUpdateSchema = z
  .object({
    eventName: z.string().trim().optional(),
    eventCity: z.string().trim().optional(),
    eventCountry: z.string().trim().optional(),
    eventDate: z.coerce.date().optional(),
    presentationType: z.enum(['oral', 'poster', 'workshop', 'keynote']).optional(),
    isbn: z.string().trim().optional(),
    conferenceAcronym: z.string().trim().optional(),
    conferenceNumber: z.string().trim().optional(),
    proceedingsTitle: z.string().trim().optional(),
    publisher: z.string().trim().optional(),
    pages: z
      .string()
      .trim()
      .regex(/^\d+(-\d+)?$/, 'Formato de páginas inválido')
      .optional(),
    eventSponsor: z.string().trim().optional(),
    areaOfKnowledge: z.string().trim().optional(),
    language: z.string().trim().optional(),
  })
  .partial()

const certificateUpdateSchema = z
  .object({
    issuingEntity: z.string().trim().optional(),
    certificateType: z
      .enum(['participacion', 'ponente', 'asistencia', 'instructor', 'otro'])
      .optional(),
    relatedEvent: z.string().trim().optional(),
    issueDate: z.coerce.date().optional(),
    expirationDate: z.coerce.date().optional(),
    hours: z.coerce.number().nonnegative().optional(),
    location: z.string().trim().optional(),
    modality: z.enum(['presencial', 'virtual', 'hibrida']).optional(),
    areaOfKnowledge: z.string().trim().optional(),
    projectCode: z.string().trim().optional(),
  })
  .partial()

const researchProjectUpdateSchema = z
  .object({
    projectCode: z.string().trim().optional(),
    fundingSource: z.string().trim().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    projectStatus: z.enum(['active', 'completed', 'suspended']).optional(),
    coResearchers: z.array(z.string().trim()).optional(),
    principalInvestigatorName: z.string().trim().optional(),
    institution: z.string().trim().optional(),
    programOrCall: z.string().trim().optional(),
    areaOfKnowledge: z.string().trim().optional(),
    keywords: z.array(z.string().trim()).optional(),
    budget: z.coerce.number().nonnegative().optional(),
  })
  .partial()

const bookUpdateSchema = z
  .object({
    bookPublisher: z.string().trim().optional(),
    bookIsbn: z.string().trim().optional(),
    bookEdition: z.string().trim().optional(),
    bookCity: z.string().trim().optional(),
    bookCollection: z.string().trim().optional(),
    bookTotalPages: z.coerce.number().int().positive().optional(),
    bookLanguage: z.string().trim().optional(),
    bookPublicationDate: z.coerce.date().optional(),
  })
  .partial()

const bookChapterUpdateSchema = z
  .object({
    chapterBookTitle: z.string().trim().optional(),
    chapterNumber: z.string().trim().optional(),
    chapterPages: z
      .string()
      .trim()
      .regex(/^\d+(-\d+)?$/, 'Formato de páginas inválido')
      .optional(),
    chapterEditors: z.array(z.string().trim()).optional(),
    chapterPublisher: z.string().trim().optional(),
    chapterIsbn: z.string().trim().optional(),
    chapterEdition: z.string().trim().optional(),
    chapterLanguage: z.string().trim().optional(),
    chapterPublicationDate: z.coerce.date().optional(),
  })
  .partial()

const technicalReportUpdateSchema = z
  .object({
    reportNumber: z.string().trim().optional(),
    reportInstitution: z.string().trim().optional(),
    reportType: z.enum(['final', 'interim', 'white_paper', 'manual', 'other']).optional(),
    reportSponsor: z.string().trim().optional(),
    reportPublicationDate: z.coerce.date().optional(),
    reportRevision: z.string().trim().optional(),
    reportPages: z.coerce.number().int().positive().optional(),
    reportRepositoryUrl: z.string().trim().url('La URL del repositorio debe ser válida').optional(),
    reportAreaOfKnowledge: z.string().trim().optional(),
    reportLanguage: z.string().trim().optional(),
  })
  .partial()

const softwareUpdateSchema = z
  .object({
    softwareVersion: z.string().trim().optional(),
    softwareReleaseDate: z.coerce.date().optional(),
    softwareRepositoryUrl: z
      .string()
      .trim()
      .url('La URL del repositorio debe ser válida')
      .optional(),
    softwareLicense: z.string().trim().optional(),
    softwareProgrammingLanguage: z.string().trim().optional(),
    softwarePlatform: z.string().trim().optional(),
    softwareType: z.enum(['desktop', 'web', 'mobile', 'library', 'other']).optional(),
    softwareRegistrationNumber: z.string().trim().optional(),
  })
  .partial()

const patentUpdateSchema = z
  .object({
    patentOffice: z.string().trim().optional(),
    patentApplicationNumber: z.string().trim().optional(),
    patentPublicationNumber: z.string().trim().optional(),
    patentApplicationDate: z.coerce.date().optional(),
    patentPublicationDate: z.coerce.date().optional(),
    patentGrantDate: z.coerce.date().optional(),
    patentStatus: z.enum(['submitted', 'published', 'granted', 'expired']).optional(),
    patentAssignee: z.string().trim().optional(),
    patentInventors: z.array(z.string().trim()).optional(),
    patentCountry: z.string().trim().optional(),
    patentClassification: z.string().trim().optional(),
  })
  .partial()

export const updateProductSchema = z.object({
  manualMetadata: manualMetadataSchema.optional(),
  action: productReviewActionSchema.optional(),
  productType: z.enum(PRODUCT_TYPES).optional(),
  article: articleUpdateSchema.optional(),
  thesis: thesisUpdateSchema.optional(),
  conferencePaper: conferencePaperUpdateSchema.optional(),
  certificate: certificateUpdateSchema.optional(),
  researchProject: researchProjectUpdateSchema.optional(),
  book: bookUpdateSchema.optional(),
  bookChapter: bookChapterUpdateSchema.optional(),
  technicalReport: technicalReportUpdateSchema.optional(),
  software: softwareUpdateSchema.optional(),
  patent: patentUpdateSchema.optional(),
})

export const productQuerySchema = z.object({
  productType: z.enum(PRODUCT_TYPES).optional(),
  owner: z.string().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(10).max(50).optional().default(20),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})
