import type { NerAttemptTraceEntry, NerProvider, ProductType } from '~~/app/types'
import AcademicProduct from '~~/server/models/AcademicProduct'
import UploadedFile from '~~/server/models/UploadedFile'
import User from '~~/server/models/User'
import { logSystemAudit } from '~~/server/utils/audit'
import { readGridFsFileToBuffer } from '~~/server/services/storage/gridfs'
import { extractDocumentText } from '~~/server/services/ocr/extract-document-text'
import { evaluateOcrQuality } from '~~/server/services/ocr/quality-gates'
import {
  classifyDocumentForNer,
  extractAcademicEntities,
  extractProductSpecificMetadata,
} from '~~/server/services/ner/extract-academic-entities'
import { resolveTextSegments } from '~~/server/services/ner/document-segmentation'
import { validateProductSpecificMetadata } from '~~/server/services/ner/product-specific-validation'
import { notifyDocumentProcessing } from '~~/server/services/notifications/notify-document-processing'
import { validateEnv } from '~~/server/utils/env'
import { classifyPipelineError, logPipelineEvent } from '~~/server/utils/pipeline-observability'
import { normalizePublicationLanguageForMongo } from '~~/server/utils/publication-language'

function getRuntimeConfigSafe(): Record<string, unknown> {
  try {
    return useRuntimeConfig()
  } catch {
    return {}
  }
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toOptionalDate(value: unknown): Date | undefined {
  const normalized = toOptionalString(value)
  if (!normalized) {
    return undefined
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined
  }

  return Number.isFinite(value) ? value : undefined
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const normalized = [
    ...new Set(
      value
        .map((item) => toOptionalString(item))
        .filter((item): item is string => typeof item === 'string'),
    ),
  ]
  return normalized.length ? normalized : undefined
}

function buildProductSpecificFields(
  productType: ProductType,
  extracted: {
    institution?: { value: string }
    eventOrJournal?: { value: string }
    date?: { value: Date }
  },
  productSpecific: Record<string, unknown> = {},
) {
  if (productType === 'article') {
    return {
      journalName: toOptionalString(productSpecific.journalName) ?? extracted.eventOrJournal?.value,
      volume: toOptionalString(productSpecific.volume),
      issue: toOptionalString(productSpecific.issue),
      pages: toOptionalString(productSpecific.pages),
      issn: toOptionalString(productSpecific.issn),
      indexing: toStringArray(productSpecific.indexing),
      openAccess:
        typeof productSpecific.openAccess === 'boolean' ? productSpecific.openAccess : undefined,
      articleType: toOptionalString(productSpecific.articleType),
      journalCountry: toOptionalString(productSpecific.journalCountry),
      journalAbbreviation: toOptionalString(productSpecific.journalAbbreviation),
      publisher: toOptionalString(productSpecific.publisher),
      areaOfKnowledge: toOptionalString(productSpecific.areaOfKnowledge),
      language: normalizePublicationLanguageForMongo(toOptionalString(productSpecific.language)),
      license: toOptionalString(productSpecific.license),
    }
  }

  if (productType === 'conference_paper') {
    return {
      eventName: toOptionalString(productSpecific.eventName) ?? extracted.eventOrJournal?.value,
      eventCity: toOptionalString(productSpecific.eventCity),
      eventCountry: toOptionalString(productSpecific.eventCountry),
      eventDate: toOptionalDate(productSpecific.eventDate) ?? extracted.date?.value,
      presentationType: toOptionalString(productSpecific.presentationType),
      isbn: toOptionalString(productSpecific.isbn),
      conferenceAcronym: toOptionalString(productSpecific.conferenceAcronym),
      conferenceNumber: toOptionalString(productSpecific.conferenceNumber),
      proceedingsTitle: toOptionalString(productSpecific.proceedingsTitle),
      publisher: toOptionalString(productSpecific.publisher),
      pages: toOptionalString(productSpecific.pages),
      eventSponsor: toOptionalString(productSpecific.eventSponsor),
      areaOfKnowledge: toOptionalString(productSpecific.areaOfKnowledge),
      language: normalizePublicationLanguageForMongo(toOptionalString(productSpecific.language)),
    }
  }

  if (productType === 'thesis') {
    return {
      thesisLevel: toOptionalString(productSpecific.thesisLevel),
      director: toOptionalString(productSpecific.director),
      university: toOptionalString(productSpecific.university) ?? extracted.institution?.value,
      faculty: toOptionalString(productSpecific.faculty),
      approvalDate: toOptionalDate(productSpecific.approvalDate) ?? extracted.date?.value,
      repositoryUrl: toOptionalString(productSpecific.repositoryUrl),
      program: toOptionalString(productSpecific.program),
      jurors: toStringArray(productSpecific.jurors),
      degreeGrantor: toOptionalString(productSpecific.degreeGrantor),
      degreeName: toOptionalString(productSpecific.degreeName),
      areaOfKnowledge: toOptionalString(productSpecific.areaOfKnowledge),
      modality: toOptionalString(productSpecific.modality),
      language: normalizePublicationLanguageForMongo(toOptionalString(productSpecific.language)),
      pages: toOptionalNumber(productSpecific.pages),
      projectCode: toOptionalString(productSpecific.projectCode),
    }
  }

  if (productType === 'certificate') {
    return {
      issuingEntity:
        toOptionalString(productSpecific.issuingEntity) ?? extracted.institution?.value,
      certificateType: toOptionalString(productSpecific.certificateType),
      relatedEvent:
        toOptionalString(productSpecific.relatedEvent) ?? extracted.eventOrJournal?.value,
      issueDate: toOptionalDate(productSpecific.issueDate) ?? extracted.date?.value,
      expirationDate: toOptionalDate(productSpecific.expirationDate),
      hours: toOptionalNumber(productSpecific.hours),
      location: toOptionalString(productSpecific.location),
      modality: toOptionalString(productSpecific.modality),
      areaOfKnowledge: toOptionalString(productSpecific.areaOfKnowledge),
      projectCode: toOptionalString(productSpecific.projectCode),
    }
  }

  if (productType === 'research_project') {
    return {
      projectCode: toOptionalString(productSpecific.projectCode),
      fundingSource: toOptionalString(productSpecific.fundingSource),
      startDate: toOptionalDate(productSpecific.startDate) ?? extracted.date?.value,
      endDate: toOptionalDate(productSpecific.endDate),
      projectStatus: toOptionalString(productSpecific.projectStatus),
      coResearchers: toStringArray(productSpecific.coResearchers),
      principalInvestigatorName: toOptionalString(productSpecific.principalInvestigatorName),
      institution: toOptionalString(productSpecific.institution) ?? extracted.institution?.value,
      programOrCall: toOptionalString(productSpecific.programOrCall),
      areaOfKnowledge: toOptionalString(productSpecific.areaOfKnowledge),
      keywords: toStringArray(productSpecific.keywords),
      budget: toOptionalNumber(productSpecific.budget),
    }
  }

  if (productType === 'book') {
    return {
      bookPublisher: toOptionalString(productSpecific.bookPublisher),
      bookIsbn: toOptionalString(productSpecific.bookIsbn),
      bookEdition: toOptionalString(productSpecific.bookEdition),
      bookCity: toOptionalString(productSpecific.bookCity),
      bookCollection: toOptionalString(productSpecific.bookCollection),
      bookTotalPages: toOptionalNumber(productSpecific.bookTotalPages),
      bookLanguage: toOptionalString(productSpecific.bookLanguage),
      bookPublicationDate: toOptionalDate(productSpecific.bookPublicationDate),
    }
  }

  if (productType === 'book_chapter') {
    return {
      chapterBookTitle: toOptionalString(productSpecific.chapterBookTitle),
      chapterNumber: toOptionalString(productSpecific.chapterNumber),
      chapterPages: toOptionalString(productSpecific.chapterPages),
      chapterEditors: toStringArray(productSpecific.chapterEditors),
      chapterPublisher: toOptionalString(productSpecific.chapterPublisher),
      chapterIsbn: toOptionalString(productSpecific.chapterIsbn),
      chapterEdition: toOptionalString(productSpecific.chapterEdition),
      chapterLanguage: toOptionalString(productSpecific.chapterLanguage),
      chapterPublicationDate: toOptionalDate(productSpecific.chapterPublicationDate),
    }
  }

  if (productType === 'technical_report') {
    return {
      reportNumber: toOptionalString(productSpecific.reportNumber),
      reportInstitution: toOptionalString(productSpecific.reportInstitution),
      reportType: toOptionalString(productSpecific.reportType),
      reportSponsor: toOptionalString(productSpecific.reportSponsor),
      reportPublicationDate: toOptionalDate(productSpecific.reportPublicationDate),
      reportRevision: toOptionalString(productSpecific.reportRevision),
      reportPages: toOptionalNumber(productSpecific.reportPages),
      reportRepositoryUrl: toOptionalString(productSpecific.reportRepositoryUrl),
      reportAreaOfKnowledge: toOptionalString(productSpecific.reportAreaOfKnowledge),
      reportLanguage: toOptionalString(productSpecific.reportLanguage),
    }
  }

  if (productType === 'software') {
    return {
      softwareVersion: toOptionalString(productSpecific.softwareVersion),
      softwareReleaseDate: toOptionalDate(productSpecific.softwareReleaseDate),
      softwareRepositoryUrl: toOptionalString(productSpecific.softwareRepositoryUrl),
      softwareLicense: toOptionalString(productSpecific.softwareLicense),
      softwareProgrammingLanguage: toOptionalString(productSpecific.softwareProgrammingLanguage),
      softwarePlatform: toOptionalString(productSpecific.softwarePlatform),
      softwareType: toOptionalString(productSpecific.softwareType),
      softwareRegistrationNumber: toOptionalString(productSpecific.softwareRegistrationNumber),
    }
  }

  if (productType === 'patent') {
    return {
      patentOffice: toOptionalString(productSpecific.patentOffice),
      patentApplicationNumber: toOptionalString(productSpecific.patentApplicationNumber),
      patentPublicationNumber: toOptionalString(productSpecific.patentPublicationNumber),
      patentApplicationDate: toOptionalDate(productSpecific.patentApplicationDate),
      patentPublicationDate: toOptionalDate(productSpecific.patentPublicationDate),
      patentGrantDate: toOptionalDate(productSpecific.patentGrantDate),
      patentStatus: toOptionalString(productSpecific.patentStatus),
      patentAssignee: toOptionalString(productSpecific.patentAssignee),
      patentInventors: toStringArray(productSpecific.patentInventors),
      patentCountry: toOptionalString(productSpecific.patentCountry),
      patentClassification: toOptionalString(productSpecific.patentClassification),
    }
  }

  return {}
}

function normalizeProcessingError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Error interno durante el procesamiento'
  return message.slice(0, 1000)
}

async function claimUploadedFileForProcessing(uploadedFileId: string) {
  return UploadedFile.findOneAndUpdate(
    {
      _id: uploadedFileId,
      isDeleted: false,
      processingStatus: { $nin: ['processing', 'completed'] },
    },
    {
      $set: {
        processingStatus: 'processing',
        processingError: null,
        processingStartedAt: new Date(),
        ocrCompletedAt: null,
        nerStartedAt: null,
        processingCompletedAt: null,
        ocrModel: null,
        nerProvider: null,
        nerModel: null,
        nerAttemptTrace: [],
        sourceWorkCount: null,
      },
      $inc: {
        processingAttempt: 1,
      },
    },
    { returnDocument: 'after' },
  )
}

export async function processUploadedFile(uploadedFileId: string): Promise<void> {
  const uploadedFile = await claimUploadedFileForProcessing(uploadedFileId)
  if (!uploadedFile) {
    return
  }

  const traceId = `upload:${uploadedFileId}:attempt:${uploadedFile.processingAttempt}`
  const processStart = Date.now()

  logPipelineEvent({
    traceId,
    documentId: uploadedFileId,
    stage: 'processing',
    event: 'start',
    attempt: uploadedFile.processingAttempt,
    metadata: {
      mimeType: uploadedFile.mimeType,
      filename: uploadedFile.originalFilename,
    },
  })

  try {
    const owner = await User.findById(uploadedFile.uploadedBy).select('fullName email').lean()
    if (!owner) {
      throw new Error('El usuario propietario del documento no existe')
    }

    const processingWarnings: string[] = []

    const fileBuffer = await readGridFsFileToBuffer(uploadedFile.gridfsFileId)
    let ocrResult = await extractDocumentText({
      buffer: fileBuffer,
      mimeType: uploadedFile.mimeType,
      traceId,
      documentId: uploadedFileId,
    })

    let ocrQuality = evaluateOcrQuality({
      text: ocrResult.text,
      provider: ocrResult.provider,
      confidence: ocrResult.confidence,
      blocksCount: ocrResult.blocks.length,
    })

    logPipelineEvent({
      traceId,
      documentId: uploadedFileId,
      stage: 'ocr',
      event: 'quality_gate_evaluated',
      provider: ocrResult.provider,
      modelId: ocrResult.modelId,
      metadata: {
        qualityStatus: ocrQuality.status,
        qualityScore: ocrQuality.score,
        reasons: ocrQuality.reasons,
        qualityGateDecision: ocrQuality.status === 'poor' ? 'retry' : 'accept',
      },
    })

    if (ocrQuality.status === 'fair') {
      processingWarnings.push(
        'El documento tiene una calidad de texto suboptima; verifica que no falten datos importantes.',
      )
    }

    if (ocrQuality.status === 'poor') {
      if (ocrResult.provider === 'gemini_vision') {
        processingWarnings.push(
          'El documento tiene baja legibilidad original; revisa y corrige metadatos manualmente.',
        )

        logPipelineEvent({
          traceId,
          documentId: uploadedFileId,
          stage: 'ocr',
          event: 'quality_gate_retry_skipped_already_vision',
          provider: ocrResult.provider,
          modelId: ocrResult.modelId,
          metadata: {
            qualityStatus: ocrQuality.status,
            qualityScore: ocrQuality.score,
            action: 'continue_with_warning',
          },
        })
      } else {
        logPipelineEvent({
          traceId,
          documentId: uploadedFileId,
          stage: 'ocr',
          event: 'quality_gate_retry_triggered',
          provider: ocrResult.provider,
          modelId: ocrResult.modelId,
          metadata: {
            qualityStatus: ocrQuality.status,
            qualityScore: ocrQuality.score,
            reasons: ocrQuality.reasons,
            qualityGateDecision: 'retry',
            forcedProvider: 'gemini_vision',
          },
        })

        const retryResult = await extractDocumentText({
          buffer: fileBuffer,
          mimeType: uploadedFile.mimeType,
          traceId,
          documentId: uploadedFileId,
          forceProvider: 'gemini_vision',
        })

        const retryQuality = evaluateOcrQuality({
          text: retryResult.text,
          provider: retryResult.provider,
          confidence: retryResult.confidence,
          blocksCount: retryResult.blocks.length,
        })

        const selectedFromRetry = retryQuality.score >= ocrQuality.score
        const selected = selectedFromRetry ? retryResult : ocrResult
        const selectedQuality = selectedFromRetry ? retryQuality : ocrQuality

        ocrResult = selected
        ocrQuality = selectedQuality

        logPipelineEvent({
          traceId,
          documentId: uploadedFileId,
          stage: 'ocr',
          event: 'quality_gate_retry_completed',
          provider: ocrResult.provider,
          modelId: ocrResult.modelId,
          metadata: {
            selectedFromRetry,
            qualityStatus: selectedQuality.status,
            qualityScore: selectedQuality.score,
            qualityGateDecision: selectedFromRetry ? 'accept_retry' : 'keep_initial',
          },
        })

        if (selectedQuality.status === 'poor') {
          processingWarnings.push(
            'La calidad OCR se mantiene baja despues del reintento; revisa y corrige metadatos manualmente.',
          )

          logPipelineEvent({
            traceId,
            documentId: uploadedFileId,
            stage: 'ocr',
            event: 'quality_gate_retry_exhausted_with_warning',
            provider: ocrResult.provider,
            modelId: ocrResult.modelId,
            metadata: {
              qualityStatus: selectedQuality.status,
              qualityScore: selectedQuality.score,
              reasons: selectedQuality.reasons,
              action: 'continue_with_warning',
            },
          })
        } else if (selectedQuality.status === 'fair') {
          processingWarnings.push(
            'La calidad OCR mejorada es regular; verifica que no falten datos importantes.',
          )
        }
      }
    }

    if (!ocrResult.text) {
      throw new Error('No fue posible extraer texto del documento')
    }

    const uploadWithOcrStart = await UploadedFile.findOneAndUpdate(
      {
        _id: uploadedFileId,
        isDeleted: false,
      },
      {
        $set: {
          ocrCompletedAt: new Date(),
          nerStartedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    )

    if (!uploadWithOcrStart) {
      logPipelineEvent({
        traceId,
        documentId: uploadedFileId,
        stage: 'processing',
        event: 'aborted_deleted_before_ner',
      })
      return
    }

    const env = validateEnv(getRuntimeConfigSafe())

    const segmentation = await resolveTextSegments({
      fullText: ocrResult.text,
      env,
      forceSingle: Boolean(uploadWithOcrStart.nerForceSingleDocument),
      traceId,
      documentId: uploadedFileId,
    })

    if (segmentation.warning) {
      processingWarnings.push(segmentation.warning)
    }

    logPipelineEvent({
      traceId,
      documentId: uploadedFileId,
      stage: 'processing',
      event: 'segmentation_resolved',
      metadata: {
        segmentCount: segmentation.segments.length,
        usedLlm: segmentation.usedLlm,
        heuristicMultiple: segmentation.heuristicMultiple,
      },
    })

    await AcademicProduct.updateMany(
      {
        sourceFile: uploadedFile._id,
        segmentIndex: { $gte: segmentation.segments.length },
        isDeleted: false,
      },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    )

    const classificationProfile = await classifyDocumentForNer(ocrResult.text)
    const segmentCount = segmentation.segments.length

    const aggregatedNerTrace: NerAttemptTraceEntry[] = []
    let primaryNerProvider: NerProvider | null = null
    let primaryNerModel: string | null = null
    let primaryProductId: string | null = null
    let anyLowConfidence = false
    let anyLowEvidence = false

    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
      const range = segmentation.segments[segmentIndex]!
      const segmentText = ocrResult.text.slice(range.textStart, range.textEnd)
      const segTraceId = `${traceId}:seg:${segmentIndex}`

      const extractedEntities = await extractAcademicEntities({
        text: segmentText,
        extractionSource: ocrResult.provider,
        ocrBlocks: segmentIndex === 0 ? ocrResult.blocks : [],
        traceId: segTraceId,
        documentId: uploadedFileId,
        classificationProfile,
        segmentMeta: { segmentIndex, segmentCount },
      })

      aggregatedNerTrace.push(...(extractedEntities.nerAttemptTrace ?? []))

      if (segmentIndex === 0) {
        primaryNerProvider = extractedEntities.nerProvider
        primaryNerModel = extractedEntities.nerModel
      }

      if (extractedEntities.extractionConfidence < 0.35) {
        anyLowConfidence = true
      }
      if (extractedEntities.evidenceCoverage < 0.25) {
        anyLowEvidence = true
      }

      let productSpecificMetadata: Record<string, unknown> = {}

      try {
        productSpecificMetadata = await extractProductSpecificMetadata({
          text: segmentText,
          productType: extractedEntities.productType,
          commonExtraction: {
            authors: extractedEntities.authors,
            title: extractedEntities.title,
            institution: extractedEntities.institution,
            date: extractedEntities.date,
            doi: extractedEntities.doi,
            eventOrJournal: extractedEntities.eventOrJournal,
          },
          traceId: segTraceId,
          documentId: uploadedFileId,
        })
      } catch (error) {
        const classified = classifyPipelineError(error)

        logPipelineEvent({
          traceId,
          documentId: uploadedFileId,
          stage: 'ner',
          event: 'product_specific_extraction_failed',
          provider: extractedEntities.nerProvider,
          modelId: extractedEntities.nerModel,
          errorType: classified.errorType,
          errorMessage: classified.errorMessage,
          metadata: {
            productType: extractedEntities.productType,
            fallback: 'only_common_metadata',
            segmentIndex,
          },
        })
      }

      const validatedProductSpecific = validateProductSpecificMetadata({
        productType: extractedEntities.productType,
        metadata: productSpecificMetadata,
      })

      if (validatedProductSpecific.droppedFields.length > 0) {
        logPipelineEvent({
          traceId,
          documentId: uploadedFileId,
          stage: 'ner',
          event: 'product_specific_validation_adjusted',
          provider: extractedEntities.nerProvider,
          modelId: extractedEntities.nerModel,
          metadata: {
            productType: extractedEntities.productType,
            droppedFields: validatedProductSpecific.droppedFields,
            corrections: validatedProductSpecific.corrections,
            segmentIndex,
          },
        })
      }

      const detectedProductType = extractedEntities.productType

      const manualMetadata = {
        title: extractedEntities.title?.value,
        authors: extractedEntities.authors.map((a) => a.value),
        institution: extractedEntities.institution?.value,
        date: extractedEntities.date?.value,
        doi: extractedEntities.doi?.value,
        keywords: extractedEntities.keywords.map((a) => a.value),
      }

      const productPayload = {
        productType: detectedProductType,
        owner: uploadedFile.uploadedBy,
        sourceFile: uploadedFile._id,
        segmentIndex,
        segmentLabel: range.label ?? undefined,
        segmentBounds: {
          textStart: range.textStart,
          textEnd: range.textEnd,
        },
        reviewStatus: 'draft' as const,
        extractedEntities,
        manualMetadata,
        ...buildProductSpecificFields(
          detectedProductType,
          extractedEntities,
          validatedProductSpecific.sanitized,
        ),
      }

      const existingProduct = await AcademicProduct.findOne({
        sourceFile: uploadedFile._id,
        segmentIndex,
        isDeleted: false,
      })

      const academicProduct = existingProduct
        ? await AcademicProduct.findByIdAndUpdate(existingProduct._id, productPayload, {
            returnDocument: 'after',
            runValidators: true,
          })
        : await AcademicProduct.create(productPayload)

      if (!academicProduct) {
        throw new Error('No fue posible persistir el producto academico')
      }

      if (segmentIndex === 0) {
        primaryProductId = academicProduct._id.toString()
      }

      await logSystemAudit({
        userId: uploadedFile.uploadedBy,
        userName: owner.fullName,
        action: existingProduct ? 'update' : 'create',
        resource: 'academic_product',
        resourceId: academicProduct._id,
        details: `Procesamiento automatico de ${uploadedFile.originalFilename} (obra ${segmentIndex + 1}/${segmentCount})`,
      })
    }

    const uploadWithMetadata = await UploadedFile.findOneAndUpdate(
      {
        _id: uploadedFileId,
        isDeleted: false,
      },
      {
        $set: {
          rawExtractedText: ocrResult.text,
          ocrProvider: ocrResult.provider,
          ocrModel: ocrResult.modelId ?? null,
          ocrConfidence: ocrResult.confidence ?? null,
          nerProvider: primaryNerProvider,
          nerModel: primaryNerModel,
          nerAttemptTrace: aggregatedNerTrace,
          documentClassification: classificationProfile.documentClassification,
          documentClassificationSource: classificationProfile.classificationSource,
          classificationConfidence: classificationProfile.classificationConfidence,
          classificationRationale: classificationProfile.classificationRationale,
          sourceWorkCount: segmentCount,
        },
      },
      { returnDocument: 'after' },
    )

    if (!uploadWithMetadata) {
      logPipelineEvent({
        traceId,
        documentId: uploadedFileId,
        stage: 'processing',
        event: 'aborted_deleted_before_persist',
      })
      return
    }

    const detectedProductType = classificationProfile.productType

    if (
      classificationProfile.documentClassification === 'non_academic' &&
      classificationProfile.classificationConfidence >= 0.75
    ) {
      processingWarnings.push(
        'El documento fue clasificado como no academico con alta confianza; valida manualmente su pertinencia.',
      )

      logPipelineEvent({
        traceId,
        documentId: uploadedFileId,
        stage: 'processing',
        event: 'classification_warning_non_academic',
        metadata: {
          classification: classificationProfile.documentClassification,
          confidence: classificationProfile.classificationConfidence,
          action: 'continue_with_manual_review',
        },
      })
    }

    if (classificationProfile.documentClassification === 'uncertain') {
      processingWarnings.push(
        'La clasificacion del documento es incierta; revisa manualmente los metadatos extraidos.',
      )

      logPipelineEvent({
        traceId,
        documentId: uploadedFileId,
        stage: 'processing',
        event: 'classification_warning_uncertain',
        metadata: {
          classification: classificationProfile.documentClassification,
          confidence: classificationProfile.classificationConfidence,
          action: 'continue_with_manual_review',
        },
      })
    }

    if (anyLowConfidence) {
      processingWarnings.push(
        'La confianza de extraccion es baja en al menos un fragmento; revisa cada borrador.',
      )

      logPipelineEvent({
        traceId,
        documentId: uploadedFileId,
        stage: 'processing',
        event: 'extraction_low_confidence_warning',
        metadata: {
          threshold: 0.35,
          action: 'continue_with_manual_review',
          multiSegment: segmentCount > 1,
        },
      })
    }

    if (anyLowEvidence) {
      processingWarnings.push(
        'En al menos un fragmento faltan muchas evidencias de campos criticos; verifica manualmente.',
      )

      logPipelineEvent({
        traceId,
        documentId: uploadedFileId,
        stage: 'processing',
        event: 'extraction_low_evidence_coverage_warning',
        metadata: {
          threshold: 0.25,
          action: 'continue_with_manual_review',
          multiSegment: segmentCount > 1,
        },
      })
    }

    if (segmentCount > 1) {
      processingWarnings.push(
        `Se generaron ${segmentCount} borradores desde el mismo archivo (posible compendio). Revisa cada obra por separado.`,
      )
    }

    const completedUpload = await UploadedFile.findOneAndUpdate(
      {
        _id: uploadedFileId,
        isDeleted: false,
      },
      {
        $set: {
          processingStatus: 'completed',
          productType: detectedProductType,
          processingError: null,
          processingCompletedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    )

    if (!completedUpload) {
      logPipelineEvent({
        traceId,
        documentId: uploadedFileId,
        stage: 'processing',
        event: 'aborted_deleted_before_completion',
      })
      return
    }

    logPipelineEvent({
      traceId,
      documentId: uploadedFileId,
      stage: 'processing',
      event: 'completed',
      durationMs: Date.now() - processStart,
      provider: primaryNerProvider ?? undefined,
      modelId: primaryNerModel ?? undefined,
      metadata: {
        ocrProvider: ocrResult.provider,
        classification: classificationProfile.documentClassification,
        segmentCount,
      },
    })

    if (primaryProductId) {
      await notifyDocumentProcessing({
        recipientId: completedUpload.uploadedBy.toString(),
        uploadedFileId: completedUpload._id.toString(),
        academicProductId: primaryProductId,
        filename: completedUpload.originalFilename,
        status: 'completed',
        warningMessage: processingWarnings.length > 0 ? processingWarnings.join(' ') : undefined,
      })
    }
  } catch (error) {
    const classified = classifyPipelineError(error)

    logPipelineEvent({
      traceId,
      documentId: uploadedFileId,
      stage: 'processing',
      event: 'failed',
      durationMs: Date.now() - processStart,
      errorType: classified.errorType,
      errorMessage: classified.errorMessage,
    })

    const currentUploadedFile = await UploadedFile.findById(uploadedFileId)
    if (!currentUploadedFile || currentUploadedFile.isDeleted) {
      return
    }

    const processingError = normalizeProcessingError(error)

    currentUploadedFile.processingStatus = 'error'
    currentUploadedFile.processingError = processingError
    currentUploadedFile.processingCompletedAt = new Date()
    await currentUploadedFile.save()

    await notifyDocumentProcessing({
      recipientId: currentUploadedFile.uploadedBy.toString(),
      uploadedFileId: currentUploadedFile._id.toString(),
      filename: currentUploadedFile.originalFilename,
      status: 'error',
      errorMessage: processingError,
    })
  }
}
