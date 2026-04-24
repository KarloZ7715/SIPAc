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

  it('decrementa contador global sin recalcular desde una pagina parcial', async () => {
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
    store.unreadCount = 5

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

    expect(store.unreadCount).toBe(4)
  })

  it('realiza refresh silencioso sin activar loading inicial ni vaciar la lista', async () => {
    const store = useNotificationsStore()
    store.notifications = [
      {
        _id: 'n1',
        type: 'processing_complete',
        title: 'Listo',
        message: 'Documento procesado',
        isRead: false,
        emailSent: false,
        createdAt: '2026-03-23T10:00:00.000Z',
      },
    ]
    store.unreadCount = 1

    let resolveFetch: ((value: unknown) => void) | null = null
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )

    const request = store.fetchNotifications({ silent: true })

    expect(store.loading).toBe(false)
    expect(store.refreshing).toBe(true)
    expect(store.notifications[0]?._id).toBe('n1')

    resolveFetch?.({
      success: true,
      data: {
        notifications: [
          {
            _id: 'n2',
            type: 'processing_complete',
            title: 'Nuevo',
            message: 'Documento nuevo',
            isRead: true,
            emailSent: false,
            createdAt: '2026-03-23T12:00:00.000Z',
          },
        ],
        unreadCount: 0,
      },
    })

    await request

    expect(store.refreshing).toBe(false)
    expect(store.notifications[0]?._id).toBe('n2')
    expect(store.unreadCount).toBe(0)
  })

  it('marca todas las notificaciones como leídas en lote', async () => {
    const store = useNotificationsStore()
    store.notifications = [
      {
        _id: 'n1',
        type: 'processing_complete',
        title: 'Listo',
        message: 'Documento procesado',
        isRead: false,
        emailSent: false,
        createdAt: '2026-03-23T10:00:00.000Z',
      },
      {
        _id: 'n2',
        type: 'processing_error',
        title: 'Error',
        message: 'Reintenta',
        isRead: false,
        emailSent: false,
        createdAt: '2026-03-23T11:00:00.000Z',
      },
    ]
    store.unreadCount = 2

    fetchMock.mockResolvedValueOnce({
      success: true,
      data: {
        updatedCount: 2,
      },
    })

    await store.markAllAsRead()

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/read-all', { method: 'PATCH' })
    expect(store.notifications.every((notification) => notification.isRead)).toBe(true)
    expect(store.unreadCount).toBe(0)
  })

  it('elimina una notificación y ajusta contador de no leídas', async () => {
    const store = useNotificationsStore()
    store.notifications = [
      {
        _id: 'n1',
        type: 'processing_complete',
        title: 'Listo',
        message: 'Documento procesado',
        isRead: false,
        emailSent: false,
        createdAt: '2026-03-23T10:00:00.000Z',
      },
      {
        _id: 'n2',
        type: 'processing_complete',
        title: 'Listo',
        message: 'Documento procesado',
        isRead: true,
        emailSent: false,
        createdAt: '2026-03-23T11:00:00.000Z',
      },
    ]
    store.unreadCount = 1

    fetchMock.mockResolvedValueOnce({
      success: true,
      data: {
        deletedId: 'n1',
        wasUnread: true,
      },
    })

    await store.deleteNotification('n1')

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/n1', { method: 'DELETE' })
    expect(store.notifications.map((notification) => notification._id)).toEqual(['n2'])
    expect(store.unreadCount).toBe(0)
  })

  it('elimina todas las notificaciones en lote', async () => {
    const store = useNotificationsStore()
    store.notifications = [
      {
        _id: 'n1',
        type: 'processing_complete',
        title: 'Listo',
        message: 'Documento procesado',
        isRead: false,
        emailSent: false,
        createdAt: '2026-03-23T10:00:00.000Z',
      },
    ]
    store.unreadCount = 1

    fetchMock.mockResolvedValueOnce({
      success: true,
      data: {
        deletedCount: 1,
      },
    })

    await store.deleteAllNotifications()

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications', { method: 'DELETE' })
    expect(store.notifications).toEqual([])
    expect(store.unreadCount).toBe(0)
  })

  it('resetea el estado local de notificaciones', () => {
    const store = useNotificationsStore()
    store.notifications = [
      {
        _id: 'n1',
        type: 'processing_complete',
        title: 'Listo',
        message: 'Documento procesado',
        isRead: false,
        emailSent: false,
        createdAt: '2026-03-23T10:00:00.000Z',
      },
    ]
    store.unreadCount = 1

    store.resetState()

    expect(store.notifications).toEqual([])
    expect(store.unreadCount).toBe(0)
    expect(store.loading).toBe(false)
    expect(store.refreshing).toBe(false)
  })

  it('captura errores en refresh silencioso para evitar rechazos no controlados', async () => {
    const store = useNotificationsStore()
    fetchMock.mockRejectedValueOnce(new Error('network'))

    await expect(store.safeFetchNotifications({ silent: true })).resolves.toBeUndefined()
  })

  it('carga incrementalmente mas notificaciones usando cursor', async () => {
    const store = useNotificationsStore()

    fetchMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          notifications: [
            {
              _id: 'n1',
              type: 'processing_complete',
              title: 'Primera',
              message: 'Primer bloque',
              isRead: false,
              emailSent: false,
              createdAt: '2026-03-23T10:00:00.000Z',
            },
          ],
          unreadCount: 1,
          nextCursor: '2026-03-23T09:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          notifications: [
            {
              _id: 'n2',
              type: 'processing_error',
              title: 'Segunda',
              message: 'Segundo bloque',
              isRead: true,
              emailSent: false,
              createdAt: '2026-03-23T08:00:00.000Z',
            },
          ],
          unreadCount: 1,
          nextCursor: null,
        },
      })

    await store.fetchNotifications()
    await store.loadMoreNotifications()

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/notifications', {
      query: { limit: 20 },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/notifications', {
      query: { cursor: '2026-03-23T09:00:00.000Z', limit: 20 },
    })
    expect(store.notifications.map((notification) => notification._id)).toEqual(['n1', 'n2'])
    expect(store.hasMore).toBe(false)
  })

  it('aplica filtro rapido de errores y refresca la bandeja', async () => {
    const store = useNotificationsStore()

    fetchMock.mockResolvedValue({
      success: true,
      data: {
        notifications: [],
        unreadCount: 0,
        nextCursor: null,
      },
    })

    store.setActiveFilter('errors')
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    expect(store.activeFilter).toBe('errors')
    expect(fetchMock).toHaveBeenCalledWith('/api/notifications', {
      query: { limit: 20, type: 'processing_error' },
    })
  })

  it('permite remover y restaurar localmente para soporte de deshacer', () => {
    const store = useNotificationsStore()
    store.notifications = [
      {
        _id: 'n1',
        type: 'processing_complete',
        title: 'Listo',
        message: 'Documento procesado',
        isRead: false,
        emailSent: false,
        createdAt: '2026-03-23T10:00:00.000Z',
      },
    ]
    store.unreadCount = 1

    const removed = store.removeNotificationLocally('n1')

    expect(removed).not.toBeNull()
    expect(store.notifications).toEqual([])
    expect(store.unreadCount).toBe(0)

    store.restoreNotificationLocally(removed!.notification, removed!.index)

    expect(store.notifications.map((notification) => notification._id)).toEqual(['n1'])
    expect(store.unreadCount).toBe(1)
  })

  it('descarta respuesta de load-more obsoleta cuando llega una nueva consulta', async () => {
    const store = useNotificationsStore()

    let resolveLoadMore: ((value: unknown) => void) | null = null

    fetchMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          notifications: [
            {
              _id: 'n1',
              type: 'processing_complete',
              title: 'Primera',
              message: 'Primer bloque',
              isRead: false,
              emailSent: false,
              createdAt: '2026-03-23T10:00:00.000Z',
            },
          ],
          unreadCount: 1,
          nextCursor: '2026-03-23T09:00:00.000Z|n1',
        },
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLoadMore = resolve
          }),
      )
      .mockResolvedValueOnce({
        success: true,
        data: {
          notifications: [
            {
              _id: 'e1',
              type: 'processing_error',
              title: 'Error',
              message: 'Filtro error',
              isRead: false,
              emailSent: false,
              createdAt: '2026-03-24T10:00:00.000Z',
            },
          ],
          unreadCount: 1,
          nextCursor: null,
        },
      })

    await store.fetchNotifications()
    const loadMoreRequest = store.loadMoreNotifications()
    store.activeFilter = 'errors'
    const resetFetchRequest = store.fetchNotifications({ silent: true })

    await vi.waitFor(() => {
      expect(store.notifications.map((notification) => notification._id)).toEqual(['e1'])
    })

    resolveLoadMore?.({
      success: true,
      data: {
        notifications: [
          {
            _id: 'n2',
            type: 'processing_complete',
            title: 'Segunda',
            message: 'Segundo bloque',
            isRead: true,
            emailSent: false,
            createdAt: '2026-03-23T08:00:00.000Z',
          },
        ],
        unreadCount: 1,
        nextCursor: null,
      },
    })
    await resetFetchRequest
    await loadMoreRequest

    expect(store.notifications.map((notification) => notification._id)).toEqual(['e1'])
  })
})
