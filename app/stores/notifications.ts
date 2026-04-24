import type {
  ApiSuccessResponse,
  NotificationListDensity,
  NotificationListQuery,
  NotificationPublic,
  NotificationQuickFilter,
  NotificationsListDTO,
} from '~~/app/types'

type NotificationsResponse = ApiSuccessResponse<NotificationsListDTO>
type NotificationResponse = ApiSuccessResponse<{ notification: NotificationPublic }>
type MarkAllAsReadResponse = ApiSuccessResponse<{ updatedCount: number }>
type DeleteNotificationResponse = ApiSuccessResponse<{ deletedId: string; wasUnread: boolean }>
type DeleteAllNotificationsResponse = ApiSuccessResponse<{ deletedCount: number }>

const NOTIFICATIONS_STORAGE_PREFIX = 'sipac:notifications'
const FILTER_STORAGE_KEY = `${NOTIFICATIONS_STORAGE_PREFIX}:quick-filter`
const AUTO_REFRESH_STORAGE_KEY = `${NOTIFICATIONS_STORAGE_PREFIX}:auto-refresh`
const POLLING_INTERVAL_STORAGE_KEY = `${NOTIFICATIONS_STORAGE_PREFIX}:polling-interval-ms`
const LIST_DENSITY_STORAGE_KEY = `${NOTIFICATIONS_STORAGE_PREFIX}:list-density`

const DEFAULT_POLLING_INTERVAL_MS = 15000
const MIN_POLLING_INTERVAL_MS = 10000
const MAX_POLLING_INTERVAL_MS = 120000
const PAGE_SIZE = 20

function readStorageValue(key: string): string | null {
  if (!import.meta.client) {
    return null
  }

  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function persistStorageValue(key: string, value: string) {
  if (!import.meta.client) {
    return
  }

  try {
    localStorage.setItem(key, value)
  } catch {
    // Persistencia opcional: no debe interrumpir la bandeja.
  }
}

function parseQuickFilter(value: string | null): NotificationQuickFilter {
  if (value === 'unread' || value === 'errors' || value === 'system') {
    return value
  }

  return 'all'
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === 'true' || value === '1') {
    return true
  }

  if (value === 'false' || value === '0') {
    return false
  }

  return fallback
}

function parsePollingIntervalMs(value: string | null): number {
  if (!value) {
    return DEFAULT_POLLING_INTERVAL_MS
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_POLLING_INTERVAL_MS
  }

  return Math.min(Math.max(parsed, MIN_POLLING_INTERVAL_MS), MAX_POLLING_INTERVAL_MS)
}

function parseDensity(value: string | null): NotificationListDensity {
  if (value === 'compact') {
    return 'compact'
  }

  return 'comfortable'
}

function buildQueryForFilter(filter: NotificationQuickFilter): NotificationListQuery {
  if (filter === 'unread') {
    return { unreadOnly: true }
  }

  if (filter === 'errors') {
    return { type: 'processing_error' }
  }

  if (filter === 'system') {
    return { type: 'system' }
  }

  return {}
}

interface NotificationRemovalSnapshot {
  notification: NotificationPublic
  index: number
}

interface FetchNotificationsOptions {
  silent?: boolean
  reset?: boolean
}

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<NotificationPublic[]>([])
  const loading = ref(false)
  const refreshing = ref(false)
  const unreadCount = ref(0)
  const markingById = ref<Record<string, boolean>>({})
  const deletingById = ref<Record<string, boolean>>({})
  const markingAll = ref(false)
  const deletingAll = ref(false)
  const loadingMore = ref(false)
  const nextCursor = ref<string | null>(null)
  const activeFilter = ref<NotificationQuickFilter>(
    parseQuickFilter(readStorageValue(FILTER_STORAGE_KEY)),
  )
  const autoRefreshEnabled = ref<boolean>(
    parseBoolean(readStorageValue(AUTO_REFRESH_STORAGE_KEY), true),
  )
  const pollingIntervalMs = ref<number>(
    parsePollingIntervalMs(readStorageValue(POLLING_INTERVAL_STORAGE_KEY)),
  )
  const listDensity = ref<NotificationListDensity>(
    parseDensity(readStorageValue(LIST_DENSITY_STORAGE_KEY)),
  )
  const hasMore = computed(() => Boolean(nextCursor.value))

  let activeFetchRequestId = 0
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function resetState() {
    activeFetchRequestId += 1
    notifications.value = []
    unreadCount.value = 0
    loading.value = false
    refreshing.value = false
    markingById.value = {}
    deletingById.value = {}
    markingAll.value = false
    deletingAll.value = false
    loadingMore.value = false
    nextCursor.value = null
    stopPolling()
  }

  async function requestNotifications(options: {
    cursor?: string
    append?: boolean
    requestId?: number
  }) {
    if (options.requestId !== undefined && options.requestId !== activeFetchRequestId) {
      return
    }

    const filterQuery = buildQueryForFilter(activeFilter.value)
    const query: NotificationListQuery = {
      ...filterQuery,
      limit: PAGE_SIZE,
      ...(options.cursor ? { cursor: options.cursor } : {}),
    }

    const response = await $fetch<NotificationsResponse>('/api/notifications', {
      query,
    })

    if (options.requestId !== undefined && options.requestId !== activeFetchRequestId) {
      return
    }

    const incomingNotifications = response.data.notifications

    if (options.append) {
      const dedupedIncoming = incomingNotifications.filter(
        (incomingNotification) =>
          !notifications.value.some(
            (existingNotification) => existingNotification._id === incomingNotification._id,
          ),
      )

      notifications.value = [...notifications.value, ...dedupedIncoming]
    } else {
      notifications.value = incomingNotifications
    }

    unreadCount.value = response.data.unreadCount
    nextCursor.value = response.data.nextCursor ?? null
  }

  async function fetchNotifications(options: FetchNotificationsOptions = {}) {
    const silent = options.silent ?? false
    const reset = options.reset ?? true

    if (!reset) {
      await loadMoreNotifications()
      return
    }

    const requestId = ++activeFetchRequestId
    const shouldKeepLayout = silent || notifications.value.length > 0

    if (shouldKeepLayout) {
      refreshing.value = true
    } else {
      loading.value = true
    }

    try {
      await requestNotifications({ requestId })

      if (requestId !== activeFetchRequestId) {
        return
      }
    } finally {
      if (requestId === activeFetchRequestId) {
        loading.value = false
        refreshing.value = false
      }
    }
  }

  async function loadMoreNotifications() {
    if (loadingMore.value || !nextCursor.value) {
      return
    }

    loadingMore.value = true
    const requestId = activeFetchRequestId

    try {
      await requestNotifications({
        cursor: nextCursor.value,
        append: true,
        requestId,
      })
    } finally {
      loadingMore.value = false
    }
  }

  async function safeFetchNotifications(options: FetchNotificationsOptions = {}) {
    try {
      await fetchNotifications(options)
    } catch {
      // Polling and focus refresh should fail silently and keep current UI state.
    }
  }

  function setMarkingNotification(notificationId: string, pending: boolean) {
    if (pending) {
      markingById.value = { ...markingById.value, [notificationId]: true }
      return
    }

    const { [notificationId]: _removed, ...remaining } = markingById.value
    markingById.value = remaining
  }

  function setDeletingNotification(notificationId: string, pending: boolean) {
    if (pending) {
      deletingById.value = { ...deletingById.value, [notificationId]: true }
      return
    }

    const { [notificationId]: _removed, ...remaining } = deletingById.value
    deletingById.value = remaining
  }

  async function markAsRead(notificationId: string) {
    setMarkingNotification(notificationId, true)

    try {
      const previousNotification = notifications.value.find(
        (notification) => notification._id === notificationId,
      )
      const response = await $fetch<NotificationResponse>(
        `/api/notifications/${notificationId}/read`,
        {
          method: 'PATCH',
        },
      )

      notifications.value = notifications.value.map((notification) =>
        notification._id === notificationId ? response.data.notification : notification,
      )

      if (
        previousNotification &&
        !previousNotification.isRead &&
        response.data.notification.isRead
      ) {
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    } finally {
      setMarkingNotification(notificationId, false)
    }
  }

  function removeNotificationLocally(notificationId: string): NotificationRemovalSnapshot | null {
    const index = notifications.value.findIndex(
      (notification) => notification._id === notificationId,
    )
    if (index < 0) {
      return null
    }

    const notification = notifications.value[index]
    if (!notification) {
      return null
    }

    const nextNotifications = notifications.value.filter(
      (existingNotification) => existingNotification._id !== notificationId,
    )

    notifications.value = nextNotifications

    if (!notification.isRead) {
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }

    return { notification, index }
  }

  function restoreNotificationLocally(notification: NotificationPublic, index: number) {
    if (
      notifications.value.some(
        (existingNotification) => existingNotification._id === notification._id,
      )
    ) {
      return
    }

    const boundedIndex = Math.min(Math.max(index, 0), notifications.value.length)
    const nextNotifications = [...notifications.value]
    nextNotifications.splice(boundedIndex, 0, notification)
    notifications.value = nextNotifications

    if (!notification.isRead) {
      unreadCount.value += 1
    }
  }

  async function commitDeleteNotification(notificationId: string) {
    setDeletingNotification(notificationId, true)

    try {
      const response = await $fetch<DeleteNotificationResponse>(
        `/api/notifications/${notificationId}`,
        {
          method: 'DELETE',
        },
      )

      return response.data
    } finally {
      setDeletingNotification(notificationId, false)
    }
  }

  async function markAllAsRead() {
    if (markingAll.value || unreadCount.value === 0) {
      return
    }

    markingAll.value = true

    try {
      await $fetch<MarkAllAsReadResponse>('/api/notifications/read-all', {
        method: 'PATCH',
      })

      notifications.value = notifications.value.map((notification) => ({
        ...notification,
        isRead: true,
      }))
      unreadCount.value = 0
    } finally {
      markingAll.value = false
    }
  }

  async function deleteNotification(notificationId: string) {
    const removedNotification = removeNotificationLocally(notificationId)

    try {
      const response = await commitDeleteNotification(notificationId)

      if (!removedNotification) {
        notifications.value = notifications.value.filter(
          (notification) => notification._id !== response.deletedId,
        )
      }

      if (!removedNotification && response.wasUnread) {
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    } catch (error) {
      if (removedNotification) {
        restoreNotificationLocally(removedNotification.notification, removedNotification.index)
      }

      throw error
    }
  }

  async function deleteAllNotifications() {
    if (deletingAll.value || notifications.value.length === 0) {
      return
    }

    deletingAll.value = true

    try {
      await $fetch<DeleteAllNotificationsResponse>('/api/notifications', {
        method: 'DELETE',
      })

      notifications.value = []
      unreadCount.value = 0
    } finally {
      deletingAll.value = false
    }
  }

  function isMarking(notificationId: string) {
    return Boolean(markingById.value[notificationId])
  }

  function isDeleting(notificationId: string) {
    return Boolean(deletingById.value[notificationId])
  }

  function setActiveFilter(nextFilter: NotificationQuickFilter) {
    if (activeFilter.value === nextFilter) {
      return
    }

    activeFetchRequestId += 1
    activeFilter.value = nextFilter
    persistStorageValue(FILTER_STORAGE_KEY, nextFilter)
    void safeFetchNotifications({ silent: true })
  }

  function setAutoRefreshEnabled(next: boolean) {
    autoRefreshEnabled.value = next
    persistStorageValue(AUTO_REFRESH_STORAGE_KEY, next ? 'true' : 'false')

    if (!next) {
      stopPolling()
      return
    }

    startPolling()
  }

  function setPollingInterval(nextIntervalMs: number) {
    const normalized = Math.min(
      Math.max(nextIntervalMs, MIN_POLLING_INTERVAL_MS),
      MAX_POLLING_INTERVAL_MS,
    )

    pollingIntervalMs.value = normalized
    persistStorageValue(POLLING_INTERVAL_STORAGE_KEY, String(normalized))

    if (pollTimer && autoRefreshEnabled.value) {
      stopPolling()
      startPolling()
    }
  }

  function setListDensity(nextDensity: NotificationListDensity) {
    listDensity.value = nextDensity
    persistStorageValue(LIST_DENSITY_STORAGE_KEY, nextDensity)
  }

  function startPolling() {
    if (!import.meta.client || pollTimer) {
      return
    }

    if (!autoRefreshEnabled.value) {
      return
    }

    void safeFetchNotifications({ silent: true })
    pollTimer = setInterval(() => {
      void safeFetchNotifications({ silent: true })
    }, pollingIntervalMs.value)
  }

  function refreshOnFocus() {
    if (!import.meta.client) {
      return
    }

    const handleFocus = () => {
      void safeFetchNotifications({ silent: true })
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    notifications,
    loading,
    refreshing,
    unreadCount,
    markingAll,
    deletingAll,
    loadingMore,
    hasMore,
    activeFilter,
    autoRefreshEnabled,
    pollingIntervalMs,
    listDensity,
    resetState,
    fetchNotifications,
    safeFetchNotifications,
    loadMoreNotifications,
    markAsRead,
    markAllAsRead,
    removeNotificationLocally,
    restoreNotificationLocally,
    commitDeleteNotification,
    deleteNotification,
    deleteAllNotifications,
    isMarking,
    isDeleting,
    setActiveFilter,
    setAutoRefreshEnabled,
    setPollingInterval,
    setListDensity,
    startPolling,
    refreshOnFocus,
    stopPolling,
  }
})
