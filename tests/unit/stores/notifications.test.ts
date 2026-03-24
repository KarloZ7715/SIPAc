import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationsStore } from '~~/app/stores/notifications'

describe('useNotificationsStore', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
    vi.stubGlobal('$fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useNotificationsStore().stopPolling()
  })

  it('hidrata las notificaciones y el contador de no leídas desde el backend', async () => {
    const store = useNotificationsStore()

    fetchMock.mockResolvedValueOnce({
      success: true,
      data: {
        notifications: [
          {
            _id: 'n1',
            type: 'processing_complete',
            title: 'Listo',
            message: 'Documento procesado',
            isRead: false,
            emailSent: true,
            createdAt: '2026-03-23T10:00:00.000Z',
          },
        ],
        unreadCount: 3,
      },
    })

    await store.fetchNotifications()

    expect(store.notifications).toHaveLength(1)
    expect(store.unreadCount).toBe(3)
  })

  it('actualiza el contador local al marcar una notificación como leída', async () => {
    const store = useNotificationsStore()
    store.notifications = [
      {
        _id: 'n1',
        type: 'processing_complete',
        title: 'Listo',
        message: 'Documento procesado',
        isRead: false,
        emailSent: true,
        createdAt: '2026-03-23T10:00:00.000Z',
      },
    ]
    store.unreadCount = 1

    fetchMock.mockResolvedValueOnce({
      success: true,
      data: {
        notification: {
          _id: 'n1',
          type: 'processing_complete',
          title: 'Listo',
          message: 'Documento procesado',
          isRead: true,
          emailSent: true,
          createdAt: '2026-03-23T10:00:00.000Z',
        },
      },
    })

    await store.markAsRead('n1')

    expect(store.notifications[0]?.isRead).toBe(true)
    expect(store.unreadCount).toBe(0)
  })
})
