import { useDocumentsStore } from '~~/app/stores/documents'

/**
 * Campos de la ficha general enlazados al store de documentos (workspace).
 */
export function useWorkspaceMetadataInputs() {
  const documentsStore = useDocumentsStore()
  const metadata = computed(() => documentsStore.workspaceDetectedMetadata)

  const titleInput = computed({
    get: () => metadata.value.title,
    set: (value: string) => documentsStore.updateDetectedMetadata({ title: value }),
  })

  const authorsInput = computed({
    get: () => metadata.value.authors.join(', '),
    set: (value: string) => {
      documentsStore.updateDetectedMetadata({
        authors: value
          .split(/,|\n/)
          .map((author) => author.trim())
          .filter(Boolean),
      })
    },
  })

  const yearInput = computed({
    get: () => metadata.value.year,
    set: (value: string) => documentsStore.updateDetectedMetadata({ year: value }),
  })

  const institutionInput = computed({
    get: () => metadata.value.institution,
    set: (value: string) => documentsStore.updateDetectedMetadata({ institution: value }),
  })

  const doiInput = computed({
    get: () => metadata.value.doi,
    set: (value: string) => documentsStore.updateDetectedMetadata({ doi: value }),
  })

  const keywordsInput = computed({
    get: () => metadata.value.keywords.join(', '),
    set: (value: string) => {
      documentsStore.updateDetectedMetadata({
        keywords: value
          .split(/,|\n/)
          .map((keyword) => keyword.trim())
          .filter(Boolean),
      })
    },
  })

  const notesInput = computed({
    get: () => metadata.value.notes,
    set: (value: string) => documentsStore.updateDetectedMetadata({ notes: value }),
  })

  return {
    titleInput,
    authorsInput,
    yearInput,
    institutionInput,
    doiInput,
    keywordsInput,
    notesInput,
  }
}
