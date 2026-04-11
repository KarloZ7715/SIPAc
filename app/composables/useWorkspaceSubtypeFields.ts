import type { Ref, ComputedRef } from 'vue'
import type { AcademicProductPublic, ProductType, UpdateAcademicProductDTO } from '~~/app/types'
import type { MetadataFieldConfig } from '~~/app/utils/product-metadata-layout'
import { PRODUCT_METADATA_LAYOUT } from '~~/app/utils/product-metadata-layout'
import { splitMultivalue, toIsoDate, toNumberValue } from '~~/app/utils/workspace-subtype-helpers'

type SupportedSubtypeProductType =
  | 'article'
  | 'thesis'
  | 'conference_paper'
  | 'certificate'
  | 'research_project'
  | 'book'
  | 'book_chapter'
  | 'technical_report'
  | 'software'
  | 'patent'

export function useWorkspaceSubtypeFields(options: {
  selectedProductType: Ref<ProductType>
  currentProduct: ComputedRef<AcademicProductPublic | null>
}) {
  const { selectedProductType, currentProduct } = options

  const articleFields = reactive({
    journalName: '',
    volume: '',
    issue: '',
    pages: '',
    issn: '',
    indexing: '',
    articleType: '' as '' | 'original' | 'revision' | 'corto' | 'carta' | 'otro',
    journalCountry: '',
    journalAbbreviation: '',
    publisher: '',
    areaOfKnowledge: '',
    language: '',
    license: '',
    openAccess: false,
  })

  const thesisFields = reactive({
    thesisLevel: '' as '' | 'pregrado' | 'maestria' | 'especializacion' | 'doctorado',
    program: '',
    director: '',
    jurors: '',
    university: '',
    faculty: '',
    degreeGrantor: '',
    degreeName: '',
    areaOfKnowledge: '',
    modality: '' as '' | 'investigacion' | 'monografia' | 'proyecto_aplicado' | 'otro',
    language: '',
    pages: '',
    projectCode: '',
    approvalDate: '',
    repositoryUrl: '',
  })

  const conferencePaperFields = reactive({
    eventName: '',
    eventCity: '',
    eventCountry: '',
    eventDate: '',
    presentationType: '' as '' | 'oral' | 'poster' | 'workshop' | 'keynote',
    isbn: '',
    conferenceAcronym: '',
    conferenceNumber: '',
    proceedingsTitle: '',
    publisher: '',
    pages: '',
    eventSponsor: '',
    areaOfKnowledge: '',
    language: '',
  })

  const certificateFields = reactive({
    issuingEntity: '',
    certificateType: '' as '' | 'participacion' | 'ponente' | 'asistencia' | 'instructor' | 'otro',
    relatedEvent: '',
    issueDate: '',
    expirationDate: '',
    hours: '',
    location: '',
    modality: '' as '' | 'presencial' | 'virtual' | 'hibrida',
    areaOfKnowledge: '',
    projectCode: '',
  })

  const researchProjectFields = reactive({
    projectCode: '',
    fundingSource: '',
    startDate: '',
    endDate: '',
    projectStatus: '' as '' | 'active' | 'completed' | 'suspended',
    coResearchers: '',
    principalInvestigatorName: '',
    institution: '',
    programOrCall: '',
    areaOfKnowledge: '',
    keywords: '',
    budget: '',
  })

  const bookFields = reactive({
    bookPublisher: '',
    bookIsbn: '',
    bookEdition: '',
    bookCity: '',
    bookCollection: '',
    bookTotalPages: '',
    bookLanguage: '',
    bookPublicationDate: '',
  })

  const bookChapterFields = reactive({
    chapterBookTitle: '',
    chapterNumber: '',
    chapterPages: '',
    chapterEditors: '',
    chapterPublisher: '',
    chapterIsbn: '',
    chapterEdition: '',
    chapterLanguage: '',
    chapterPublicationDate: '',
  })

  const technicalReportFields = reactive({
    reportNumber: '',
    reportInstitution: '',
    reportType: '' as '' | 'final' | 'interim' | 'white_paper' | 'manual' | 'other',
    reportSponsor: '',
    reportPublicationDate: '',
    reportRevision: '',
    reportPages: '',
    reportRepositoryUrl: '',
    reportAreaOfKnowledge: '',
    reportLanguage: '',
  })

  const softwareFields = reactive({
    softwareVersion: '',
    softwareReleaseDate: '',
    softwareRepositoryUrl: '',
    softwareLicense: '',
    softwareProgrammingLanguage: '',
    softwarePlatform: '',
    softwareType: '' as '' | 'desktop' | 'web' | 'mobile' | 'library' | 'other',
    softwareRegistrationNumber: '',
  })

  const patentFields = reactive({
    patentOffice: '',
    patentApplicationNumber: '',
    patentPublicationNumber: '',
    patentApplicationDate: '',
    patentPublicationDate: '',
    patentGrantDate: '',
    patentStatus: '' as '' | 'submitted' | 'published' | 'granted' | 'expired',
    patentAssignee: '',
    patentInventors: '',
    patentCountry: '',
    patentClassification: '',
  })

  const subtypeFieldsByProductType = {
    article: articleFields,
    thesis: thesisFields,
    conference_paper: conferencePaperFields,
    certificate: certificateFields,
    research_project: researchProjectFields,
    book: bookFields,
    book_chapter: bookChapterFields,
    technical_report: technicalReportFields,
    software: softwareFields,
    patent: patentFields,
  } as const

  const specificFieldsByProductType = computed(() =>
    PRODUCT_METADATA_LAYOUT[selectedProductType.value].filter(
      (field) => field.group !== 'Campos generales',
    ),
  )

  const groupedSpecificFields = computed(() => {
    const grouped = new Map<string, MetadataFieldConfig[]>()

    specificFieldsByProductType.value.forEach((field) => {
      const current = grouped.get(field.group) ?? []
      current.push(field)
      grouped.set(field.group, current)
    })

    return Array.from(grouped.entries()).map(([group, fields]) => ({ group, fields }))
  })

  function toSupportedSubtypeProductType(value: ProductType): SupportedSubtypeProductType {
    return value as SupportedSubtypeProductType
  }

  function getSubtypeFieldName(field: MetadataFieldConfig) {
    return `${selectedProductType.value}-${field.id}`
  }

  function getSubtypeFieldValue(field: MetadataFieldConfig): string | boolean {
    const productType = toSupportedSubtypeProductType(selectedProductType.value)
    const subtypeFields = subtypeFieldsByProductType[productType] as Record<string, unknown>
    const currentValue = subtypeFields[field.id]

    if (field.control === 'switch') {
      return Boolean(currentValue)
    }

    return typeof currentValue === 'string' ? currentValue : ''
  }

  function setSubtypeFieldValue(field: MetadataFieldConfig, value: string | boolean) {
    const productType = toSupportedSubtypeProductType(selectedProductType.value)
    const subtypeFields = subtypeFieldsByProductType[productType] as Record<string, unknown>

    subtypeFields[field.id] = field.control === 'switch' ? Boolean(value) : String(value ?? '')
  }

  function getFieldClass(field: MetadataFieldConfig) {
    return field.control === 'textarea' ? '@lg/metadata-form:col-span-2' : ''
  }

  function buildSubtypeUpdatePayload(): Partial<UpdateAcademicProductDTO> {
    if (selectedProductType.value === 'article') {
      return {
        article: {
          journalName: articleFields.journalName || undefined,
          volume: articleFields.volume || undefined,
          issue: articleFields.issue || undefined,
          pages: articleFields.pages || undefined,
          issn: articleFields.issn || undefined,
          indexing: splitMultivalue(articleFields.indexing),
          openAccess: articleFields.openAccess,
          articleType: articleFields.articleType || undefined,
          journalCountry: articleFields.journalCountry || undefined,
          journalAbbreviation: articleFields.journalAbbreviation || undefined,
          publisher: articleFields.publisher || undefined,
          areaOfKnowledge: articleFields.areaOfKnowledge || undefined,
          language: articleFields.language || undefined,
          license: articleFields.license || undefined,
        },
      }
    }

    if (selectedProductType.value === 'thesis') {
      return {
        thesis: {
          thesisLevel: thesisFields.thesisLevel || undefined,
          director: thesisFields.director || undefined,
          university: thesisFields.university || undefined,
          faculty: thesisFields.faculty || undefined,
          approvalDate: toIsoDate(thesisFields.approvalDate),
          repositoryUrl: thesisFields.repositoryUrl || undefined,
          program: thesisFields.program || undefined,
          jurors: splitMultivalue(thesisFields.jurors),
          degreeGrantor: thesisFields.degreeGrantor || undefined,
          degreeName: thesisFields.degreeName || undefined,
          areaOfKnowledge: thesisFields.areaOfKnowledge || undefined,
          modality: thesisFields.modality || undefined,
          language: thesisFields.language || undefined,
          pages: toNumberValue(thesisFields.pages),
          projectCode: thesisFields.projectCode || undefined,
        },
      }
    }

    if (selectedProductType.value === 'conference_paper') {
      return {
        conferencePaper: {
          eventName: conferencePaperFields.eventName || undefined,
          eventCity: conferencePaperFields.eventCity || undefined,
          eventCountry: conferencePaperFields.eventCountry || undefined,
          eventDate: toIsoDate(conferencePaperFields.eventDate),
          presentationType: conferencePaperFields.presentationType || undefined,
          isbn: conferencePaperFields.isbn || undefined,
          conferenceAcronym: conferencePaperFields.conferenceAcronym || undefined,
          conferenceNumber: conferencePaperFields.conferenceNumber || undefined,
          proceedingsTitle: conferencePaperFields.proceedingsTitle || undefined,
          publisher: conferencePaperFields.publisher || undefined,
          pages: conferencePaperFields.pages || undefined,
          eventSponsor: conferencePaperFields.eventSponsor || undefined,
          areaOfKnowledge: conferencePaperFields.areaOfKnowledge || undefined,
          language: conferencePaperFields.language || undefined,
        },
      }
    }

    if (selectedProductType.value === 'certificate') {
      return {
        certificate: {
          issuingEntity: certificateFields.issuingEntity || undefined,
          certificateType: certificateFields.certificateType || undefined,
          relatedEvent: certificateFields.relatedEvent || undefined,
          issueDate: toIsoDate(certificateFields.issueDate),
          expirationDate: toIsoDate(certificateFields.expirationDate),
          hours: toNumberValue(certificateFields.hours),
          location: certificateFields.location || undefined,
          modality: certificateFields.modality || undefined,
          areaOfKnowledge: certificateFields.areaOfKnowledge || undefined,
          projectCode: certificateFields.projectCode || undefined,
        },
      }
    }

    if (selectedProductType.value === 'research_project') {
      return {
        researchProject: {
          projectCode: researchProjectFields.projectCode || undefined,
          fundingSource: researchProjectFields.fundingSource || undefined,
          startDate: toIsoDate(researchProjectFields.startDate),
          endDate: toIsoDate(researchProjectFields.endDate),
          projectStatus: researchProjectFields.projectStatus || undefined,
          coResearchers: splitMultivalue(researchProjectFields.coResearchers),
          principalInvestigatorName: researchProjectFields.principalInvestigatorName || undefined,
          institution: researchProjectFields.institution || undefined,
          programOrCall: researchProjectFields.programOrCall || undefined,
          areaOfKnowledge: researchProjectFields.areaOfKnowledge || undefined,
          keywords: splitMultivalue(researchProjectFields.keywords),
          budget: toNumberValue(researchProjectFields.budget),
        },
      }
    }

    if (selectedProductType.value === 'book') {
      return {
        book: {
          bookPublisher: bookFields.bookPublisher || undefined,
          bookIsbn: bookFields.bookIsbn || undefined,
          bookEdition: bookFields.bookEdition || undefined,
          bookCity: bookFields.bookCity || undefined,
          bookCollection: bookFields.bookCollection || undefined,
          bookTotalPages: toNumberValue(bookFields.bookTotalPages),
          bookLanguage: bookFields.bookLanguage || undefined,
          bookPublicationDate: toIsoDate(bookFields.bookPublicationDate),
        },
      }
    }

    if (selectedProductType.value === 'book_chapter') {
      return {
        bookChapter: {
          chapterBookTitle: bookChapterFields.chapterBookTitle || undefined,
          chapterNumber: bookChapterFields.chapterNumber || undefined,
          chapterPages: bookChapterFields.chapterPages || undefined,
          chapterEditors: splitMultivalue(bookChapterFields.chapterEditors),
          chapterPublisher: bookChapterFields.chapterPublisher || undefined,
          chapterIsbn: bookChapterFields.chapterIsbn || undefined,
          chapterEdition: bookChapterFields.chapterEdition || undefined,
          chapterLanguage: bookChapterFields.chapterLanguage || undefined,
          chapterPublicationDate: toIsoDate(bookChapterFields.chapterPublicationDate),
        },
      }
    }

    if (selectedProductType.value === 'technical_report') {
      return {
        technicalReport: {
          reportNumber: technicalReportFields.reportNumber || undefined,
          reportInstitution: technicalReportFields.reportInstitution || undefined,
          reportType: technicalReportFields.reportType || undefined,
          reportSponsor: technicalReportFields.reportSponsor || undefined,
          reportPublicationDate: toIsoDate(technicalReportFields.reportPublicationDate),
          reportRevision: technicalReportFields.reportRevision || undefined,
          reportPages: toNumberValue(technicalReportFields.reportPages),
          reportRepositoryUrl: technicalReportFields.reportRepositoryUrl || undefined,
          reportAreaOfKnowledge: technicalReportFields.reportAreaOfKnowledge || undefined,
          reportLanguage: technicalReportFields.reportLanguage || undefined,
        },
      }
    }

    if (selectedProductType.value === 'software') {
      return {
        software: {
          softwareVersion: softwareFields.softwareVersion || undefined,
          softwareReleaseDate: toIsoDate(softwareFields.softwareReleaseDate),
          softwareRepositoryUrl: softwareFields.softwareRepositoryUrl || undefined,
          softwareLicense: softwareFields.softwareLicense || undefined,
          softwareProgrammingLanguage: softwareFields.softwareProgrammingLanguage || undefined,
          softwarePlatform: softwareFields.softwarePlatform || undefined,
          softwareType: softwareFields.softwareType || undefined,
          softwareRegistrationNumber: softwareFields.softwareRegistrationNumber || undefined,
        },
      }
    }

    return {
      patent: {
        patentOffice: patentFields.patentOffice || undefined,
        patentApplicationNumber: patentFields.patentApplicationNumber || undefined,
        patentPublicationNumber: patentFields.patentPublicationNumber || undefined,
        patentApplicationDate: toIsoDate(patentFields.patentApplicationDate),
        patentPublicationDate: toIsoDate(patentFields.patentPublicationDate),
        patentGrantDate: toIsoDate(patentFields.patentGrantDate),
        patentStatus: patentFields.patentStatus || undefined,
        patentAssignee: patentFields.patentAssignee || undefined,
        patentInventors: splitMultivalue(patentFields.patentInventors),
        patentCountry: patentFields.patentCountry || undefined,
        patentClassification: patentFields.patentClassification || undefined,
      },
    }
  }

  function hydrateSubtypeFieldsFromProduct() {
    const product = currentProduct.value
    if (!product) {
      return
    }

    if (product.productType === 'article') {
      articleFields.journalName = product.journalName ?? ''
      articleFields.volume = product.volume ?? ''
      articleFields.issue = product.issue ?? ''
      articleFields.pages = product.pages ?? ''
      articleFields.issn = product.issn ?? ''
      articleFields.indexing = (product.indexing ?? []).join(', ')
      articleFields.articleType = (product.articleType as typeof articleFields.articleType) ?? ''
      articleFields.journalCountry = product.journalCountry ?? ''
      articleFields.journalAbbreviation = product.journalAbbreviation ?? ''
      articleFields.publisher = product.publisher ?? ''
      articleFields.areaOfKnowledge = product.areaOfKnowledge ?? ''
      articleFields.language = product.language ?? ''
      articleFields.license = product.license ?? ''
      articleFields.openAccess = product.openAccess ?? false
    }

    if (product.productType === 'thesis') {
      thesisFields.thesisLevel = (product.thesisLevel as typeof thesisFields.thesisLevel) ?? ''
      thesisFields.program = product.program ?? ''
      thesisFields.director = product.director ?? ''
      thesisFields.jurors = (product.jurors ?? []).join(', ')
      thesisFields.university = product.university ?? ''
      thesisFields.faculty = product.faculty ?? ''
      thesisFields.degreeGrantor = product.degreeGrantor ?? ''
      thesisFields.degreeName = product.degreeName ?? ''
      thesisFields.areaOfKnowledge = product.thesisAreaOfKnowledge ?? product.areaOfKnowledge ?? ''
      thesisFields.modality = (product.thesisModality ?? '') as typeof thesisFields.modality
      thesisFields.language = product.thesisLanguage ?? product.language ?? ''
      thesisFields.pages = product.thesisPages ?? product.pages ?? ''
      thesisFields.projectCode = product.projectCode ?? ''
      thesisFields.approvalDate = product.approvalDate ? product.approvalDate.slice(0, 10) : ''
      thesisFields.repositoryUrl = product.repositoryUrl ?? ''
    }

    if (product.productType === 'conference_paper') {
      conferencePaperFields.eventName = product.eventName ?? ''
      conferencePaperFields.eventCity = product.eventCity ?? ''
      conferencePaperFields.eventCountry = product.eventCountry ?? ''
      conferencePaperFields.eventDate = product.eventDate ? product.eventDate.slice(0, 10) : ''
      conferencePaperFields.presentationType =
        (product.presentationType as typeof conferencePaperFields.presentationType) ?? ''
      conferencePaperFields.isbn = product.isbn ?? ''
      conferencePaperFields.conferenceAcronym = product.conferenceAcronym ?? ''
      conferencePaperFields.conferenceNumber = product.conferenceNumber ?? ''
      conferencePaperFields.proceedingsTitle = product.proceedingsTitle ?? ''
      conferencePaperFields.publisher = product.publisher ?? ''
      conferencePaperFields.pages = product.conferencePages ?? product.pages ?? ''
      conferencePaperFields.eventSponsor = product.eventSponsor ?? ''
      conferencePaperFields.areaOfKnowledge =
        product.conferenceAreaOfKnowledge ?? product.areaOfKnowledge ?? ''
      conferencePaperFields.language = product.conferenceLanguage ?? product.language ?? ''
    }

    if (product.productType === 'certificate') {
      certificateFields.issuingEntity = product.issuingEntity ?? ''
      certificateFields.certificateType =
        (product.certificateType as typeof certificateFields.certificateType) ?? ''
      certificateFields.relatedEvent = product.relatedEvent ?? ''
      certificateFields.issueDate = product.issueDate ? product.issueDate.slice(0, 10) : ''
      certificateFields.expirationDate = product.expirationDate
        ? product.expirationDate.slice(0, 10)
        : ''
      certificateFields.hours =
        typeof product.hours === 'number' && Number.isFinite(product.hours)
          ? String(product.hours)
          : ''
      certificateFields.location = product.location ?? ''
      certificateFields.modality =
        (product.certificateModality as typeof certificateFields.modality) ?? ''
      certificateFields.areaOfKnowledge = product.certificateAreaOfKnowledge ?? ''
      certificateFields.projectCode = product.projectCode ?? ''
    }

    if (product.productType === 'research_project') {
      researchProjectFields.projectCode = product.projectCode ?? ''
      researchProjectFields.fundingSource = product.fundingSource ?? ''
      researchProjectFields.startDate = product.startDate ? product.startDate.slice(0, 10) : ''
      researchProjectFields.endDate = product.endDate ? product.endDate.slice(0, 10) : ''
      researchProjectFields.projectStatus =
        (product.projectStatus as typeof researchProjectFields.projectStatus) ?? ''
      researchProjectFields.coResearchers = (product.coResearchers ?? []).join(', ')
      researchProjectFields.principalInvestigatorName = product.principalInvestigatorName ?? ''
      researchProjectFields.institution = product.researchProjectInstitution ?? ''
      researchProjectFields.programOrCall = product.programOrCall ?? ''
      researchProjectFields.areaOfKnowledge = product.researchProjectAreaOfKnowledge ?? ''
      researchProjectFields.keywords = (product.researchProjectKeywords ?? []).join(', ')
      researchProjectFields.budget =
        typeof product.budget === 'number' && Number.isFinite(product.budget)
          ? String(product.budget)
          : ''
    }

    if (product.productType === 'book') {
      bookFields.bookPublisher = product.bookPublisher ?? ''
      bookFields.bookIsbn = product.bookIsbn ?? ''
      bookFields.bookEdition = product.bookEdition ?? ''
      bookFields.bookCity = product.bookCity ?? ''
      bookFields.bookCollection = product.bookCollection ?? ''
      bookFields.bookTotalPages =
        typeof product.bookTotalPages === 'number' && Number.isFinite(product.bookTotalPages)
          ? String(product.bookTotalPages)
          : ''
      bookFields.bookLanguage = product.bookLanguage ?? ''
      bookFields.bookPublicationDate = product.bookPublicationDate
        ? product.bookPublicationDate.slice(0, 10)
        : ''
    }

    if (product.productType === 'book_chapter') {
      bookChapterFields.chapterBookTitle = product.chapterBookTitle ?? ''
      bookChapterFields.chapterNumber = product.chapterNumber ?? ''
      bookChapterFields.chapterPages = product.chapterPages ?? ''
      bookChapterFields.chapterEditors = (product.chapterEditors ?? []).join(', ')
      bookChapterFields.chapterPublisher = product.chapterPublisher ?? ''
      bookChapterFields.chapterIsbn = product.chapterIsbn ?? ''
      bookChapterFields.chapterEdition = product.chapterEdition ?? ''
      bookChapterFields.chapterLanguage = product.chapterLanguage ?? ''
      bookChapterFields.chapterPublicationDate = product.chapterPublicationDate
        ? product.chapterPublicationDate.slice(0, 10)
        : ''
    }

    if (product.productType === 'technical_report') {
      technicalReportFields.reportNumber = product.reportNumber ?? ''
      technicalReportFields.reportInstitution = product.reportInstitution ?? ''
      technicalReportFields.reportType =
        (product.reportType as typeof technicalReportFields.reportType) ?? ''
      technicalReportFields.reportSponsor = product.reportSponsor ?? ''
      technicalReportFields.reportPublicationDate = product.reportPublicationDate
        ? product.reportPublicationDate.slice(0, 10)
        : ''
      technicalReportFields.reportRevision = product.reportRevision ?? ''
      technicalReportFields.reportPages =
        typeof product.reportPages === 'number' && Number.isFinite(product.reportPages)
          ? String(product.reportPages)
          : ''
      technicalReportFields.reportRepositoryUrl = product.reportRepositoryUrl ?? ''
      technicalReportFields.reportAreaOfKnowledge = product.reportAreaOfKnowledge ?? ''
      technicalReportFields.reportLanguage = product.reportLanguage ?? ''
    }

    if (product.productType === 'software') {
      softwareFields.softwareVersion = product.softwareVersion ?? ''
      softwareFields.softwareReleaseDate = product.softwareReleaseDate
        ? product.softwareReleaseDate.slice(0, 10)
        : ''
      softwareFields.softwareRepositoryUrl = product.softwareRepositoryUrl ?? ''
      softwareFields.softwareLicense = product.softwareLicense ?? ''
      softwareFields.softwareProgrammingLanguage = product.softwareProgrammingLanguage ?? ''
      softwareFields.softwarePlatform = product.softwarePlatform ?? ''
      softwareFields.softwareType =
        (product.softwareType as typeof softwareFields.softwareType) ?? ''
      softwareFields.softwareRegistrationNumber = product.softwareRegistrationNumber ?? ''
    }

    if (product.productType === 'patent') {
      patentFields.patentOffice = product.patentOffice ?? ''
      patentFields.patentApplicationNumber = product.patentApplicationNumber ?? ''
      patentFields.patentPublicationNumber = product.patentPublicationNumber ?? ''
      patentFields.patentApplicationDate = product.patentApplicationDate
        ? product.patentApplicationDate.slice(0, 10)
        : ''
      patentFields.patentPublicationDate = product.patentPublicationDate
        ? product.patentPublicationDate.slice(0, 10)
        : ''
      patentFields.patentGrantDate = product.patentGrantDate
        ? product.patentGrantDate.slice(0, 10)
        : ''
      patentFields.patentStatus = (product.patentStatus as typeof patentFields.patentStatus) ?? ''
      patentFields.patentAssignee = product.patentAssignee ?? ''
      patentFields.patentInventors = (product.patentInventors ?? []).join(', ')
      patentFields.patentCountry = product.patentCountry ?? ''
      patentFields.patentClassification = product.patentClassification ?? ''
    }
  }

  return {
    groupedSpecificFields,
    getSubtypeFieldName,
    getSubtypeFieldValue,
    setSubtypeFieldValue,
    getFieldClass,
    buildSubtypeUpdatePayload,
    hydrateSubtypeFieldsFromProduct,
  }
}
