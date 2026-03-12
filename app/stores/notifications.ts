import type { ApiSuccessResponse, NotificationPublic } from '~~/app/types'

type NotificationsResponse = ApiSuccessResponse<{ notifications: NotificationPublic[] }>
type NotificationResponse = ApiSuccessResponse<{ notification: NotificationPublic }>

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<NotificationPublic[]>([])
  const loading = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const unreadCount = computed(
    () => notifications.value.filter((notification) => !notification.isRead).length,
  )

  async function fetchNotifications(unreadOnly = false) {
    loading.value = true

    try {
      const response = await $fetch<NotificationsResponse>('/api/notifications', {
        query: unreadOnly ? { unreadOnly: true } : undefined,
      })

      notifications.value = response.data.notifications
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
    stopPolling,
  }
})
