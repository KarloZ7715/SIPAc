import mongoose from 'mongoose'
import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import { buildProductWorkspaceDraft } from '~~/server/utils/product'
import { logAudit } from '~~/server/utils/audit'
import {
  createBadRequestError,
  createAuthorizationError,
  createNotFoundError,
  createValidationError,
} from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'
import { updateProductSchema } from '~~/server/utils/schemas/product'

function normalizeOptionalText(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function resolveEffectiveTitle(input: {
  manualTitle?: string
  currentManualTitle?: string
  extractedTitle?: string
}): string | undefined {
  return (
    normalizeOptionalText(input.manualTitle) ??
    normalizeOptionalText(input.currentManualTitle) ??
    normalizeOptionalText(input.extractedTitle)
  )
}

function resolveEffectiveAuthors(input: {
  manualAuthors?: string[]
  currentManualAuthors?: string[]
  extractedAuthors?: string[]
}): string[] {
  const candidates =
    input.manualAuthors ?? input.currentManualAuthors ?? input.extractedAuthors ?? []

  return candidates.map((author) => author.trim()).filter(Boolean)
}

const subtypeFieldsByProductType: Record<string, string[]> = {
  article: [
    'journalName',
    'volume',
    'issue',
    'pages',
    'issn',
    'indexing',
    'openAccess',
    'articleType',
    'journalCountry',
    'journalAbbreviation',
    'publisher',
    'areaOfKnowledge',
    'language',
    'license',
  ],
  conference_paper: [
    'eventName',
    'eventCity',
    'eventCountry',
    'eventDate',
    'presentationType',
    'isbn',
    'conferenceAcronym',
    'conferenceNumber',
    'proceedingsTitle',
    'publisher',
    'pages',
    'eventSponsor',
    'areaOfKnowledge',
    'language',
  ],
  thesis: [
    'thesisLevel',
    'director',
    'university',
    'faculty',
    'approvalDate',
    'repositoryUrl',
    'program',
    'jurors',
    'degreeGrantor',
    'degreeName',
    'areaOfKnowledge',
    'modality',
    'language',
    'pages',
    'projectCode',
  ],
  certificate: [
    'issuingEntity',
    'certificateType',
    'relatedEvent',
    'issueDate',
    'expirationDate',
    'hours',
    'location',
    'modality',
    'areaOfKnowledge',
    'projectCode',
  ],
  research_project: [
    'projectCode',
    'fundingSource',
    'startDate',
    'endDate',
    'projectStatus',
    'coResearchers',
    'principalInvestigatorName',
    'institution',
    'programOrCall',
    'areaOfKnowledge',
    'keywords',
    'budget',
  ],
  book: [
    'bookPublisher',
    'bookIsbn',
    'bookEdition',
    'bookCity',
    'bookCollection',
    'bookTotalPages',
    'bookLanguage',
    'bookPublicationDate',
  ],
  book_chapter: [
    'chapterBookTitle',
    'chapterNumber',
    'chapterPages',
    'chapterEditors',
    'chapterPublisher',
    'chapterIsbn',
    'chapterEdition',
    'chapterLanguage',
    'chapterPublicationDate',
  ],
  technical_report: [
    'reportNumber',
    'reportInstitution',
    'reportType',
    'reportSponsor',
    'reportPublicationDate',
    'reportRevision',
    'reportPages',
    'reportRepositoryUrl',
    'reportAreaOfKnowledge',
    'reportLanguage',
  ],
  software: [
    'softwareVersion',
    'softwareReleaseDate',
    'softwareRepositoryUrl',
    'softwareLicense',
    'softwareProgrammingLanguage',
    'softwarePlatform',
    'softwareType',
    'softwareRegistrationNumber',
  ],
  patent: [
    'patentOffice',
    'patentApplicationNumber',
    'patentPublicationNumber',
    'patentApplicationDate',
    'patentPublicationDate',
    'patentGrantDate',
    'patentStatus',
    'patentAssignee',
    'patentInventors',
    'patentCountry',
    'patentClassification',
  ],
}

function buildSubtypeUnsetPayload(nextProductType: string) {
  const allSubtypeFields = Object.values(subtypeFieldsByProductType).flat()
  const keepFields = new Set(subtypeFieldsByProductType[nextProductType] ?? [])

  const unsetPayload: Record<string, 1> = {}
  allSubtypeFields.forEach((field) => {
    if (!keepFields.has(field)) {
      unsetPayload[field] = 1
    }
  })

  return unsetPayload
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const productId = getRouterParam(event, 'id')
  if (!productId || !mongoose.isValidObjectId(productId)) {
    throw createNotFoundError('Producto academico')
  }

  const body = await readBody(event)
  const parsed = updateProductSchema.safeParse(body)

  if (!parsed.success) {
    throw createValidationError(parsed.error)
  }

  const {
    manualMetadata,
    action,
    productType,
    article,
    thesis,
    conferencePaper,
    certificate,
    researchProject,
    book,
    bookChapter,
    technicalReport,
    software,
    patent,
  } = parsed.data
  if (
    !manualMetadata &&
    !action &&
    !productType &&
    !article &&
    !thesis &&
    !conferencePaper &&
    !certificate &&
    !researchProject &&
    !book &&
    !bookChapter &&
    !technicalReport &&
    !software &&
    !patent
  ) {
    throw createBadRequestError('Se debe enviar al menos un cambio para actualizar')
  }

  let product = await AcademicProduct.findById(productId)
  if (!product || product.isDeleted) {
    throw createNotFoundError('Producto academico')
  }

  const isOwner = product.owner.toString() === auth.sub
  if (!isOwner && auth.role !== 'admin') {
    throw createAuthorizationError()
  }

  if (productType && productType !== product.productType) {
    const unsetPayload = buildSubtypeUnsetPayload(productType)

    const updatedProduct = await AcademicProduct.findByIdAndUpdate(
      product._id,
      {
        $set: { productType },
        $unset: unsetPayload,
      },
      {
        returnDocument: 'after',
        runValidators: true,
        overwriteDiscriminatorKey: true,
      },
    )

    if (!updatedProduct) {
      throw createNotFoundError('Producto academico')
    }

    product = updatedProduct

    await UploadedFile.findByIdAndUpdate(product.sourceFile, {
      productType,
    })
  }

  if (manualMetadata) {
    product.manualMetadata = {
      ...product.manualMetadata,
      ...manualMetadata,
      authors: manualMetadata.authors ?? product.manualMetadata.authors ?? [],
      keywords: manualMetadata.keywords ?? product.manualMetadata.keywords ?? [],
    }
  }

  const effectiveProductType = (productType ?? product.productType) as string

  if (effectiveProductType === 'article' && article) {
    Object.assign(product, article)
  }

  if (effectiveProductType === 'thesis' && thesis) {
    Object.assign(product, thesis)
  }

  if (effectiveProductType === 'conference_paper' && conferencePaper) {
    Object.assign(product, conferencePaper)
  }

  if (effectiveProductType === 'certificate' && certificate) {
    Object.assign(product, certificate)
  }

  if (effectiveProductType === 'research_project' && researchProject) {
    Object.assign(product, researchProject)
  }

  if (effectiveProductType === 'book' && book) {
    Object.assign(product, book)
  }

  if (effectiveProductType === 'book_chapter' && bookChapter) {
    Object.assign(product, bookChapter)
  }

  if (effectiveProductType === 'technical_report' && technicalReport) {
    Object.assign(product, technicalReport)
  }

  if (effectiveProductType === 'software' && software) {
    Object.assign(product, software)
  }

  if (effectiveProductType === 'patent' && patent) {
    Object.assign(product, patent)
  }

  if (action === 'confirm') {
    const effectiveTitle = resolveEffectiveTitle({
      manualTitle: manualMetadata?.title,
      currentManualTitle: product.manualMetadata.title,
      extractedTitle: product.extractedEntities.title?.value,
    })
    const effectiveAuthors = resolveEffectiveAuthors({
      manualAuthors: manualMetadata?.authors,
      currentManualAuthors: product.manualMetadata.authors,
      extractedAuthors: product.extractedEntities.authors.map((author) => author.value),
    })

    if (!effectiveProductType || !effectiveTitle || effectiveAuthors.length === 0) {
      throw createBadRequestError(
        'Para confirmar debes completar tipo de producto, titulo y al menos un autor',
      )
    }

    product.reviewStatus = 'confirmed'
    product.reviewConfirmedAt = new Date()
  }

  await product.save()

  const uploadedFile = await UploadedFile.findById(product.sourceFile).lean()
  if (!uploadedFile || uploadedFile.isDeleted) {
    throw createNotFoundError('Archivo')
  }

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'update',
    resource: 'academic_product',
    resourceId: product._id,
    details: [
      action === 'confirm'
        ? `Confirmacion manual del borrador ${product._id.toString()}`
        : `Actualizacion de borrador ${product._id.toString()}`,
      productType ? `Tipo definido por usuario: ${productType}` : undefined,
    ]
      .filter(Boolean)
      .join(' | '),
  })

  return ok({
    draft: buildProductWorkspaceDraft(product.toJSON(), uploadedFile),
  })
})
