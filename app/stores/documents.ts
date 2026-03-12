import type {
  ApiSuccessResponse,
  ProductType,
  UploadedFilePublic,
  UploadedFileStatusDTO,
} from '~~/app/types'

type UploadResponse = ApiSuccessResponse<{ uploadedFile: UploadedFilePublic }>
type UploadStatusResponse = ApiSuccessResponse<UploadedFileStatusDTO>
type DeleteUploadResponse = ApiSuccessResponse<{ message: string }>

export interface TrackedDocument extends UploadedFilePublic, UploadedFileStatusDTO {
  academicProductId?: string
}

export const useDocumentsStore = defineStore('documents', () => {
  const documents = ref<TrackedDocument[]>([])
  const uploading = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const activeDocuments = computed(() =>
    documents.value.filter((document) =>
      ['pending', 'processing'].includes(document.processingStatus),
    ),
  )

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

  async function uploadDocument(file: File, productType: ProductType) {
    uploading.value = true

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('productType', productType)

      const response = await $fetch<UploadResponse>('/api/upload', {
        method: 'POST',
        body: formData,
      })

      upsertDocument(response.data.uploadedFile)
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
  }

  async function pollActiveStatuses() {
    if (!activeDocuments.value.length) {
      stopPolling()
      return
    }

    await Promise.all(
      activeDocuments.value.map((document) =>
        refreshDocumentStatus(document._id).catch(() => undefined),
      ),
    )
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

  function startPolling(intervalMs = 5000) {
    if (!import.meta.client || pollTimer) {
      return
    }

    pollTimer = setInterval(() => {
      void pollActiveStatuses()
    }, intervalMs)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    documents,
    uploading,
    activeDocuments,
    uploadDocument,
    refreshDocumentStatus,
    pollActiveStatuses,
    deleteDocument,
    startPolling,
    stopPolling,
  }
})
