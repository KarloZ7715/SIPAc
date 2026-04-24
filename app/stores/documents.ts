import type {
  AcademicProductPublic,
  ApiSuccessResponse,
  PaginationMeta,
  ProductWorkspaceDraftDTO,
  ProductType,
  UpdateAcademicProductDTO,
  UploadedFilePublic,
  UploadedFileStatusDTO,
} from '~~/app/types'
import { PRODUCT_TYPES } from '~~/app/types'

type UploadResponse = ApiSuccessResponse<{ uploadedFile: UploadedFilePublic }>
type UploadStatusResponse = ApiSuccessResponse<UploadedFileStatusDTO>
type DeleteUploadResponse = ApiSuccessResponse<{ message: string }>
type ProductDraftResponse = ApiSuccessResponse<{ draft: ProductWorkspaceDraftDTO | null }>
type ProductsListResponse = ApiSuccessResponse<AcademicProductPublic[]>
type DeleteProductResponse = ApiSuccessResponse<{ deleted: boolean }>
type StoreFetch = <T>(request: string, options?: Parameters<typeof $fetch>[1]) => Promise<T>

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export type RepositorySortBy = 'date_desc' | 'date_asc' | 'title_asc' | 'title_desc'

export interface RepositoryFilters {
  productType?: ProductType
  year?: string
  owner?: string
  institution?: string
  search?: string
  title?: string
  author?: string
  keyword?: string
  program?: string
  faculty?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: RepositorySortBy
  page?: number
  limit?: number
}

export type WorkspaceStage = 'empty' | 'draft' | 'analyzing' | 'review' | 'ready' | 'confirmed'

export interface WorkspaceMetadataDraft {
  title: string
  authors: string[]
  institution: string
  year: string
  doi: string
  keywords: string[]
  notes: string
}

export interface TrackedDocument extends UploadedFilePublic, UploadedFileStatusDTO {
  academicProductId?: string
  academicProductIds?: string[]
  sourceWorkCount?: number
}

function createEmptyWorkspaceMetadata(): WorkspaceMetadataDraft {
  return {
    title: '',
    authors: [],
    institution: '',
    year: '',
    doi: '',
    keywords: [],
    notes: '',
  }
}

function buildUploadedFilePreviewUrl(uploadId: string) {
  return `/api/upload/${uploadId}/file`
}

export const useDocumentsStore = defineStore('documents', () => {
  const documents = ref<TrackedDocument[]>([])
  const uploading = ref(false)
  const loadingDraft = ref(false)
  const savingDraft = ref(false)
  const cancelingDraft = ref(false)
  const activeUploadId = ref<string | null>(null)
  const activeAcademicProductId = ref<string | null>(null)
  const draftProduct = ref<ProductWorkspaceDraftDTO | null>(null)
  const workspaceDraftFile = shallowRef<File | null>(null)
  const workspaceDraftPreviewUrl = ref<string | null>(null)
  const workspaceDraftProductType = ref<ProductType>('article')
  const workspaceStage = ref<WorkspaceStage>('empty')
  const workspaceDetectedMetadata = reactive<WorkspaceMetadataDraft>(createEmptyWorkspaceMetadata())
  let pollTimer: ReturnType<typeof setInterval> | null = null
  /** Encadenamiento de cargas de borrador: evita que una respuesta antigua pise estado nuevo. */
  let draftLoadGeneration = 0
  let draftLoadAbort: AbortController | null = null
  const pollConsecutiveFailures = ref(0)

  const activeDocuments = computed(() =>
    documents.value.filter((document) =>
      ['pending', 'processing'].includes(document.processingStatus),
    ),
  )

  const hasWorkspaceDraft = computed(
    () => !!workspaceDraftFile.value || !!draftProduct.value || !!activeTrackedDocument.value,
  )
  const hasPersistedDraft = computed(() => !!draftProduct.value)
  const draftAccess = computed(() => draftProduct.value?.access)
  const canEditDraft = computed(() => draftAccess.value?.canEdit !== false)
  const canDeleteDraft = computed(() => draftAccess.value?.canDelete !== false)
  const activeTrackedDocument = computed(() => {
    if (!activeUploadId.value) {
      return null
    }

    return documents.value.find((document) => document._id === activeUploadId.value) ?? null
  })

  const canConfirmDraft = computed(
    () =>
      PRODUCT_TYPES.includes(workspaceDraftProductType.value) &&
      workspaceDetectedMetadata.title.trim().length > 0 &&
      workspaceDetectedMetadata.authors.some((author) => author.trim().length > 0) &&
      canEditDraft.value,
  )

  function resetWorkspaceMetadata() {
    Object.assign(workspaceDetectedMetadata, createEmptyWorkspaceMetadata())
  }

  function replaceWorkspacePreviewUrl(url: string | null) {
    if (import.meta.client && workspaceDraftPreviewUrl.value) {
      try {
        URL.revokeObjectURL(workspaceDraftPreviewUrl.value)
      } catch {
        // Ignore non-blob URLs.
      }
    }

    workspaceDraftPreviewUrl.value = url
  }

  function setWorkspacePreviewFromFile(file: File | null) {
    replaceWorkspacePreviewUrl(import.meta.client && file ? URL.createObjectURL(file) : null)
  }

  function setWorkspacePreviewFromUpload(uploadId: string | null) {
    replaceWorkspacePreviewUrl(uploadId ? buildUploadedFilePreviewUrl(uploadId) : null)
  }

  function setWorkspaceProductType(productType: ProductType) {
    workspaceDraftProductType.value = productType
    syncReviewStage()
  }

  function prepareWorkspaceDraft(file: File, productType: ProductType = 'article') {
    workspaceDraftFile.value = file
    workspaceDraftProductType.value = productType
    workspaceStage.value = 'draft'
    activeUploadId.value = null
    draftProduct.value = null
    activeAcademicProductId.value = null
    resetWorkspaceMetadata()
    setWorkspacePreviewFromFile(file)
  }

  function setWorkspaceStage(stage: WorkspaceStage) {
    workspaceStage.value = stage
  }

  function updateDetectedMetadata(payload: Partial<WorkspaceMetadataDraft>) {
    Object.assign(workspaceDetectedMetadata, payload)
    syncReviewStage()
  }

  function clearWorkspaceDraft() {
    workspaceDraftFile.value = null
    workspaceDraftProductType.value = 'article'
    workspaceStage.value = 'empty'
    activeUploadId.value = null
    activeAcademicProductId.value = null
    draftProduct.value = null
    resetWorkspaceMetadata()
    setWorkspacePreviewFromUpload(null)
  }

  function syncReviewStage() {
    if (workspaceStage.value === 'review' || workspaceStage.value === 'ready') {
      workspaceStage.value = canConfirmDraft.value ? 'ready' : 'review'
    }
  }

  function toWorkspaceMetadata(product: AcademicProductPublic): WorkspaceMetadataDraft {
    const sourceDate = product.manualMetadata.date ?? product.extractedEntities.date?.value

    return {
      title: product.manualMetadata.title ?? product.extractedEntities.title?.value ?? '',
      authors:
        product.manualMetadata.authors.length > 0
          ? product.manualMetadata.authors
          : product.extractedEntities.authors.map((a) => a.value),
      institution:
        product.manualMetadata.institution ?? product.extractedEntities.institution?.value ?? '',
      year: sourceDate ? String(new Date(sourceDate).getUTCFullYear()) : '',
      doi: product.manualMetadata.doi ?? product.extractedEntities.doi?.value ?? '',
      keywords:
        product.manualMetadata.keywords.length > 0
          ? product.manualMetadata.keywords
          : product.extractedEntities.keywords.map((k) => k.value),
      notes: product.manualMetadata.notes ?? '',
    }
  }

  function applyDraftSnapshot(snapshot: ProductWorkspaceDraftDTO) {
    draftProduct.value = snapshot
    activeAcademicProductId.value = snapshot.product._id
    activeUploadId.value = snapshot.uploadedFile._id
    workspaceDraftProductType.value = snapshot.product.productType
    Object.assign(workspaceDetectedMetadata, toWorkspaceMetadata(snapshot.product))
    upsertDocument(snapshot.uploadedFile)
    setWorkspacePreviewFromUpload(snapshot.uploadedFile._id)

    if (snapshot.product.reviewStatus === 'confirmed') {
      const mayEdit = snapshot.access?.canEdit === true
      const mayDeleteUpload = snapshot.access?.canDelete === true
      // Producto ya en repositorio: el propietario puede seguir corrigiendo metadatos en la misma UI
      // de revisión, pero sin exponer "Cancelar proceso" (DELETE del upload borraría todas las obras).
      if (mayEdit && !mayDeleteUpload) {
        workspaceStage.value = canConfirmDraft.value ? 'ready' : 'review'
        return
      }

      workspaceStage.value = 'confirmed'
      return
    }

    workspaceStage.value = canConfirmDraft.value ? 'ready' : 'review'
  }

  function createManualMetadataPayload(currentProduct?: AcademicProductPublic) {
    const selectedYear = workspaceDetectedMetadata.year.trim()
    const fallbackDate =
      currentProduct?.manualMetadata.date ?? currentProduct?.extractedEntities.date?.value
    const fallbackYear = fallbackDate ? String(new Date(fallbackDate).getUTCFullYear()) : ''

    let date: string | undefined

    if (selectedYear) {
      date =
        fallbackDate && fallbackYear === selectedYear
          ? fallbackDate
          : new Date(`${selectedYear}-01-01T00:00:00.000Z`).toISOString()
    }

    return {
      title: workspaceDetectedMetadata.title.trim() || undefined,
      authors: workspaceDetectedMetadata.authors,
      institution: workspaceDetectedMetadata.institution.trim() || undefined,
      date,
      doi: workspaceDetectedMetadata.doi.trim() || undefined,
      keywords: workspaceDetectedMetadata.keywords,
      notes: workspaceDetectedMetadata.notes.trim() || undefined,
    }
  }

  function upsertDocument(payload: TrackedDocument) {
    const nextDocuments = [...documents.value]
    const existingIndex = nextDocuments.findIndex((candidate) => candidate._id === payload._id)

    if (existingIndex >= 0) {
      nextDocuments[existingIndex] = {
        ...nextDocuments[existingIndex],
        ...payload,
      }
    } else {
      nextDocuments.unshift(payload)
    }

    documents.value = nextDocuments.sort(
      (left, right) => +new Date(right.createdAt) - +new Date(left.createdAt),
    )
  }

  async function uploadDocument(file: File, options?: { nerForceSingleDocument?: boolean }) {
    uploading.value = true
    workspaceStage.value = 'analyzing'
    draftProduct.value = null
    activeAcademicProductId.value = null

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (options?.nerForceSingleDocument) {
        formData.append('nerForceSingleDocument', 'true')
      }

      const response = await $fetch<UploadResponse>('/api/upload', {
        method: 'POST',
        body: formData,
      })

      activeUploadId.value = response.data.uploadedFile._id
      upsertDocument(response.data.uploadedFile)
      setWorkspacePreviewFromUpload(response.data.uploadedFile._id)
      await refreshDocumentStatus(response.data.uploadedFile._id)
      startPolling()

      return response.data.uploadedFile
    } finally {
      uploading.value = false
    }
  }

  async function refreshDocumentStatus(documentId: string) {
    const response = await $fetch<UploadStatusResponse>(`/api/upload/${documentId}/status`)
    const existing = documents.value.find((document) => document._id === documentId)

    if (!existing) {
      return
    }

    upsertDocument({
      ...existing,
      ...response.data,
    })

    if (response.data.academicProductId) {
      activeUploadId.value = documentId
      activeAcademicProductId.value = response.data.academicProductId

      if (response.data.reviewStatus === 'confirmed') {
        workspaceStage.value = 'confirmed'
      } else if (response.data.processingStatus === 'completed') {
        await loadDraftProduct(response.data.academicProductId)
      }
    }
  }

  async function pollActiveStatuses() {
    if (!activeDocuments.value.length) {
      stopPolling()
      return
    }

    const outcomes = await Promise.all(
      activeDocuments.value.map(async (document) => {
        try {
          await refreshDocumentStatus(document._id)
          return 'ok' as const
        } catch {
          return 'fail' as const
        }
      }),
    )

    if (outcomes.includes('ok')) {
      pollConsecutiveFailures.value = 0
      return
    }

    pollConsecutiveFailures.value += 1
  }

  async function deleteDocument(documentId: string) {
    await $fetch<DeleteUploadResponse>(`/api/upload/${documentId}`, {
      method: 'DELETE',
    })

    documents.value = documents.value.filter((document) => document._id !== documentId)

    if (!activeDocuments.value.length) {
      stopPolling()
    }
  }

  async function loadCurrentDraft(fetcher: StoreFetch = $fetch) {
    const gen = ++draftLoadGeneration
    draftLoadAbort?.abort()
    draftLoadAbort = new AbortController()
    const { signal } = draftLoadAbort
    loadingDraft.value = true

    try {
      const response = await fetcher<ProductDraftResponse>('/api/products/drafts/current', {
        signal,
      })

      if (gen !== draftLoadGeneration) {
        return null
      }

      if (!response.data.draft) {
        if (!workspaceDraftFile.value) {
          clearWorkspaceDraft()
        }

        return null
      }

      applyDraftSnapshot(response.data.draft)
      return response.data.draft
    } catch (error) {
      if (isAbortError(error)) {
        return null
      }
      throw error
    } finally {
      if (gen === draftLoadGeneration) {
        loadingDraft.value = false
      }
    }
  }

  async function loadDraftProduct(productId: string, fetcher: StoreFetch = $fetch) {
    const gen = ++draftLoadGeneration
    draftLoadAbort?.abort()
    draftLoadAbort = new AbortController()
    const { signal } = draftLoadAbort
    loadingDraft.value = true

    try {
      const response = await fetcher<ProductDraftResponse>(`/api/products/${productId}`, {
        signal,
      })

      if (gen !== draftLoadGeneration) {
        return null
      }

      if (!response.data.draft) {
        return null
      }

      applyDraftSnapshot(response.data.draft)
      return response.data.draft
    } catch (error) {
      if (isAbortError(error)) {
        return null
      }
      throw error
    } finally {
      if (gen === draftLoadGeneration) {
        loadingDraft.value = false
      }
    }
  }

  async function saveDraftChanges(extra?: Partial<UpdateAcademicProductDTO>) {
    if (!activeAcademicProductId.value || !draftProduct.value) {
      return null
    }

    savingDraft.value = true

    try {
      const basePayload: UpdateAcademicProductDTO = {
        action: 'save-draft',
        productType: workspaceDraftProductType.value,
        manualMetadata: createManualMetadataPayload(draftProduct.value.product),
      }

      const payload: UpdateAcademicProductDTO = {
        ...extra,
        ...basePayload,
      }

      const response = await $fetch<ProductDraftResponse>(
        `/api/products/${activeAcademicProductId.value}`,
        {
          method: 'PATCH',
          body: payload,
        },
      )

      if (response.data.draft) {
        applyDraftSnapshot(response.data.draft)
      }
      repositoryCache.clear()

      return response.data.draft
    } finally {
      savingDraft.value = false
    }
  }

  async function confirmDraft(extra?: Partial<UpdateAcademicProductDTO>) {
    if (!activeAcademicProductId.value || !draftProduct.value) {
      return null
    }

    savingDraft.value = true

    try {
      const basePayload: UpdateAcademicProductDTO = {
        action: 'confirm',
        productType: workspaceDraftProductType.value,
        manualMetadata: createManualMetadataPayload(draftProduct.value.product),
      }

      const payload: UpdateAcademicProductDTO = {
        ...extra,
        ...basePayload,
      }

      const response = await $fetch<ProductDraftResponse>(
        `/api/products/${activeAcademicProductId.value}`,
        {
          method: 'PATCH',
          body: payload,
        },
      )

      if (response.data.draft) {
        applyDraftSnapshot(response.data.draft)
      }
      repositoryCache.clear()

      return response.data.draft
    } finally {
      savingDraft.value = false
    }
  }

  async function cancelDraft() {
    if (!canDeleteDraft.value) {
      return
    }

    if (!activeUploadId.value) {
      clearWorkspaceDraft()
      return
    }

    cancelingDraft.value = true

    try {
      await deleteDocument(activeUploadId.value)
      clearWorkspaceDraft()
    } finally {
      cancelingDraft.value = false
    }
  }

  function getPollingInterval(): number {
    if (!import.meta.client) return 5000
    const conn = (navigator as { connection?: { effectiveType?: string } }).connection
    if (conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return 15000
    if (conn?.effectiveType === '3g') return 10000
    return 5000
  }

  function startPolling(intervalMs?: number) {
    if (!import.meta.client || pollTimer) {
      return
    }

    const interval = intervalMs ?? getPollingInterval()

    void pollActiveStatuses()
    pollTimer = setInterval(() => {
      void pollActiveStatuses()
    }, interval)
  }

  function refreshOnFocus() {
    if (!import.meta.client) {
      return
    }

    const handleFocus = () => {
      if (activeDocuments.value.length > 0) {
        void pollActiveStatuses()
      }
    }

    // Pause polling when tab is hidden, resume when visible
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else if (activeDocuments.value.length > 0) {
        startPolling()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const repositoryProducts = ref<AcademicProductPublic[]>([])
  const repositoryLoading = ref(false)
  const repositoryCache = new Map<string, { data: ProductsListResponse; timestamp: number }>()
  const REPOSITORY_CACHE_MAX = 50
  const REPOSITORY_CACHE_TTL_MS = 5 * 60 * 1000 // 5 min

  function repositoryCacheSet(key: string, value: ProductsListResponse) {
    if (repositoryCache.size >= REPOSITORY_CACHE_MAX) {
      const firstKey = repositoryCache.keys().next().value
      if (firstKey) repositoryCache.delete(firstKey)
    }
    repositoryCache.set(key, { data: value, timestamp: Date.now() })
  }

  function repositoryCacheGet(key: string): ProductsListResponse | undefined {
    const entry = repositoryCache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.timestamp > REPOSITORY_CACHE_TTL_MS) {
      repositoryCache.delete(key)
      return undefined
    }
    return entry.data
  }
  const repositoryFilters = reactive<RepositoryFilters>({
    productType: undefined,
    year: undefined,
    owner: undefined,
    institution: undefined,
    search: undefined,
    title: undefined,
    author: undefined,
    keyword: undefined,
    program: undefined,
    faculty: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    sortBy: 'date_desc',
    page: 1,
    limit: 10,
  })
  const repositoryMeta = ref<PaginationMeta | null>(null)

  function buildRepositoryQueryParams(filters: RepositoryFilters) {
    const params = new URLSearchParams()
    if (filters.productType) {
      params.set('productType', filters.productType)
    }
    if (filters.year) {
      params.set('year', filters.year)
    }
    if (filters.owner) {
      params.set('owner', filters.owner)
    }
    if (filters.institution) {
      params.set('institution', filters.institution)
    }
    if (filters.search) {
      params.set('search', filters.search)
    }
    if (filters.title) {
      params.set('title', filters.title)
    }
    if (filters.author) {
      params.set('author', filters.author)
    }
    if (filters.keyword) {
      params.set('keyword', filters.keyword)
    }
    if (filters.program) {
      params.set('program', filters.program)
    }
    if (filters.faculty) {
      params.set('faculty', filters.faculty)
    }
    if (filters.dateFrom) {
      params.set('dateFrom', filters.dateFrom)
    }
    if (filters.dateTo) {
      params.set('dateTo', filters.dateTo)
    }
    if (filters.sortBy) {
      params.set('sortBy', filters.sortBy)
    }
    params.set('page', String(filters.page ?? 1))
    params.set('limit', String(filters.limit ?? 10))
    return params
  }

  async function prefetchRepositoryPage(page: number) {
    const nextPage = Math.max(1, page)
    const nextFilters: RepositoryFilters = {
      ...repositoryFilters,
      page: nextPage,
    }
    const queryString = buildRepositoryQueryParams(nextFilters).toString()
    if (repositoryCacheGet(queryString)) {
      return
    }
    const url = `/api/products${queryString ? `?${queryString}` : ''}`
    const response = await $fetch<ProductsListResponse>(url)
    repositoryCacheSet(queryString, response)
  }

  async function fetchProducts(filters?: Partial<RepositoryFilters>, fetcher: StoreFetch = $fetch) {
    try {
      if (filters) {
        Object.assign(repositoryFilters, filters)
      }

      const params = buildRepositoryQueryParams(repositoryFilters)

      const queryString = params.toString()
      const cached = repositoryCacheGet(queryString)
      if (cached) {
        repositoryProducts.value = cached.data
        repositoryMeta.value = cached.meta ?? null
        return cached
      }

      repositoryLoading.value = true
      const url = `/api/products${queryString ? `?${queryString}` : ''}`

      const response = await fetcher<ProductsListResponse>(url)
      repositoryCacheSet(queryString, response)
      repositoryProducts.value = response.data
      repositoryMeta.value = response.meta ?? null

      if (response.meta?.hasMore && response.meta.page) {
        // Cachea la siguiente página para navegación más fluida.
        void prefetchRepositoryPage(response.meta.page + 1).catch(() => {})
      }

      return response
    } finally {
      repositoryLoading.value = false
    }
  }

  async function deleteProduct(productId: string) {
    const response = await $fetch<DeleteProductResponse>(`/api/products/${productId}`, {
      method: 'DELETE',
    })

    repositoryProducts.value = repositoryProducts.value.filter((p) => p._id !== productId)
    repositoryCache.clear()

    if (repositoryMeta.value) {
      repositoryMeta.value = {
        ...repositoryMeta.value,
        total: repositoryMeta.value.total - 1,
      }
    }

    return response
  }

  function resetRepositoryFilters() {
    repositoryFilters.productType = undefined
    repositoryFilters.year = undefined
    repositoryFilters.owner = undefined
    repositoryFilters.institution = undefined
    repositoryFilters.search = undefined
    repositoryFilters.title = undefined
    repositoryFilters.author = undefined
    repositoryFilters.keyword = undefined
    repositoryFilters.program = undefined
    repositoryFilters.faculty = undefined
    repositoryFilters.dateFrom = undefined
    repositoryFilters.dateTo = undefined
    repositoryFilters.sortBy = 'date_desc'
    repositoryFilters.page = 1
    repositoryFilters.limit = 10
    repositoryCache.clear()
  }

  return {
    documents,
    uploading,
    loadingDraft,
    savingDraft,
    cancelingDraft,
    activeUploadId,
    activeAcademicProductId,
    draftProduct,
    activeDocuments,
    activeTrackedDocument,
    draftAccess,
    canEditDraft,
    canDeleteDraft,
    hasPersistedDraft,
    canConfirmDraft,
    hasWorkspaceDraft,
    workspaceDraftFile,
    workspaceDraftPreviewUrl,
    workspaceDraftProductType,
    workspaceStage,
    workspaceDetectedMetadata,
    pollConsecutiveFailures,
    uploadDocument,
    refreshDocumentStatus,
    pollActiveStatuses,
    deleteDocument,
    loadCurrentDraft,
    loadDraftProduct,
    saveDraftChanges,
    confirmDraft,
    cancelDraft,
    startPolling,
    refreshOnFocus,
    stopPolling,
    setWorkspaceProductType,
    prepareWorkspaceDraft,
    setWorkspaceStage,
    updateDetectedMetadata,
    clearWorkspaceDraft,
    resetWorkspaceMetadata,
    repositoryProducts,
    repositoryLoading,
    repositoryFilters,
    repositoryMeta,
    fetchProducts,
    deleteProduct,
    resetRepositoryFilters,
  }
})
