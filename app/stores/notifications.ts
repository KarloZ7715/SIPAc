import type { ApiSuccessResponse, NotificationsListDTO, NotificationPublic } from '~~/app/types'

type NotificationsResponse = ApiSuccessResponse<NotificationsListDTO>
type NotificationResponse = ApiSuccessResponse<{ notification: NotificationPublic }>

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<NotificationPublic[]>([])
  const loading = ref(false)
  const unreadCount = ref(0)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function fetchNotifications(unreadOnly = false) {
    loading.value = true

    try {
      const response = await $fetch<NotificationsResponse>('/api/notifications', {
        query: unreadOnly ? { unreadOnly: true } : undefined,
      })

      notifications.value = response.data.notifications
      unreadCount.value = response.data.unreadCount
    } finally {
      loading.value = false
    }
  }

  async function markAsRead(notificationId: string) {
    const response = await $fetch<NotificationResponse>(
      `/api/notifications/${notificationId}/read`,
      {
        method: 'PATCH',
      },
    )

    notifications.value = notifications.value.map((notification) =>
      notification._id === notificationId ? response.data.notification : notification,
    )
    unreadCount.value = notifications.value.filter((notification) => !notification.isRead).length
  }

  function startPolling(intervalMs = 15000) {
    if (!import.meta.client || pollTimer) {
      return
    }

    void fetchNotifications()
    pollTimer = setInterval(() => {
      void fetchNotifications()
    }, intervalMs)
  }

  function refreshOnFocus() {
    if (!import.meta.client) {
      return
    }

    const handleFocus = () => {
      void fetchNotifications()
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
    unreadCount,
    fetchNotifications,
    markAsRead,
    startPolling,
    refreshOnFocus,
    stopPolling,
  }
})
