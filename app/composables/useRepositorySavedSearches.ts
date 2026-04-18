const STORAGE_KEY = 'sipac-repository-saved-searches'
const MAX_SAVED_SEARCHES = 20
const NAME_MAX_LENGTH = 80

/**
 * Búsqueda guardada: lista nombrada de pares `query` para restaurar.
 * Se guarda el query exacto de la URL, evitando reinterpretarlo al cargar.
 */
export interface SavedSearch {
  id: string
  name: string
  query: Record<string, string>
  savedAt: string
}

function loadFromStorage(): SavedSearch[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is SavedSearch => {
      if (!item || typeof item !== 'object') return false
      const record = item as Record<string, unknown>
      return (
        typeof record.id === 'string' &&
        typeof record.name === 'string' &&
        typeof record.savedAt === 'string' &&
        record.query !== null &&
        typeof record.query === 'object'
      )
    })
  } catch {
    return []
  }
}

function persist(savedSearches: SavedSearch[]) {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSearches.slice(0, MAX_SAVED_SEARCHES)))
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Guarda búsquedas frecuentes del repositorio en `localStorage`.
 * No comparte entre dispositivos (aceptable: es un atajo personal).
 */
export function useRepositorySavedSearches() {
  const savedSearches = ref<SavedSearch[]>([])

  function refresh() {
    savedSearches.value = loadFromStorage()
  }

  function save(name: string, query: Record<string, string>): SavedSearch | null {
    const cleanName = name.trim().slice(0, NAME_MAX_LENGTH)
    if (!cleanName) return null

    const entry: SavedSearch = {
      id: generateId(),
      name: cleanName,
      query: { ...query },
      savedAt: new Date().toISOString(),
    }

    savedSearches.value = [entry, ...savedSearches.value].slice(0, MAX_SAVED_SEARCHES)
    persist(savedSearches.value)
    return entry
  }

  function remove(id: string) {
    savedSearches.value = savedSearches.value.filter((item) => item.id !== id)
    persist(savedSearches.value)
  }

  function clearAll() {
    savedSearches.value = []
    persist(savedSearches.value)
  }

  if (import.meta.client) {
    refresh()
  }

  return { savedSearches, save, remove, clearAll, refresh }
}
