import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { findMock, sortMock, limitMock, countDocumentsMock, getQueryMock } = vi.hoisted(() => ({
  findMock: vi.fn(),
  sortMock: vi.fn(),
  limitMock: vi.fn(),
  countDocumentsMock: vi.fn(),
  getQueryMock: vi.fn(),
}))

vi.mock('~~/server/models/Notification', () => ({
  default: {
    find: findMock,
    countDocuments: countDocumentsMock,
  },
}))

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    findMock.mockReturnValue({
      sort: sortMock,
    })

    sortMock.mockReturnValue({
      limit: limitMock,
    })

    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('requireAuth', () => ({ sub: '507f191e810c19729de860ea' }))
    vi.stubGlobal('getQuery', getQueryMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retorna primera pagina con limit por defecto y nextCursor nulo cuando no llena la pagina', async () => {
    getQueryMock.mockReturnValue({})

    const createdAt = new Date('2026-03-23T10:00:00.000Z')
    limitMock.mockResolvedValueOnce([
      {
        createdAt,
        toJSON: () => ({
          _id: 'n1',
          type: 'processing_complete',
          title: 'Listo',
          message: 'Documento procesado',
          isRead: false,
          emailSent: false,
          createdAt,
        }),
      },
    ])
    countDocumentsMock.mockResolvedValueOnce(2)

    const { default: handler } = await import('~~/server/api/notifications/index.get')
    const result = await (handler as (e: unknown) => Promise<{ data: unknown }>)({})

    expect(findMock).toHaveBeenCalledWith({
      recipientId: '507f191e810c19729de860ea',
    })
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1, _id: -1 })
    expect(limitMock).toHaveBeenCalledWith(20)
    expect(result).toMatchObject({
      data: {
        unreadCount: 2,
        nextCursor: null,
      },
    })
  })

  it('aplica filtros por tipo, unreadOnly y cursor, acotando el limite maximo', async () => {
    getQueryMock.mockReturnValue({
      unreadOnly: 'true',
      type: 'processing_error',
      cursor: '2026-03-23T10:00:00.000Z',
      limit: '500',
    })

    const olderDate = new Date('2026-03-22T09:00:00.000Z')
    limitMock.mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, index) => ({
        createdAt: new Date(olderDate.getTime() - index * 60_000),
        toJSON: () => ({
          _id: `n${index}`,
          type: 'processing_error',
          title: 'Error',
          message: 'No se pudo procesar',
          isRead: false,
          emailSent: false,
          createdAt: new Date(olderDate.getTime() - index * 60_000),
        }),
      })),
    )
    countDocumentsMock.mockResolvedValueOnce(5)

    const { default: handler } = await import('~~/server/api/notifications/index.get')
    const result = await (
      handler as (e: unknown) => Promise<{ data: { nextCursor: string | null } }>
    )({})

    expect(findMock).toHaveBeenCalledWith({
      recipientId: '507f191e810c19729de860ea',
      isRead: false,
      type: 'processing_error',
      createdAt: { $lt: new Date('2026-03-23T10:00:00.000Z') },
    })
    expect(limitMock).toHaveBeenCalledWith(50)
    expect(result.data.nextCursor).not.toBeNull()
  })

  it('usa cursor compuesto para evitar saltos cuando hay empate de createdAt', async () => {
    getQueryMock.mockReturnValue({
      cursor: '2026-03-23T10:00:00.000Z|507f191e810c19729de860ef',
    })

    limitMock.mockResolvedValueOnce([])
    countDocumentsMock.mockResolvedValueOnce(0)

    const { default: handler } = await import('~~/server/api/notifications/index.get')
    await (handler as (e: unknown) => Promise<unknown>)({})

    expect(findMock).toHaveBeenCalledWith({
      recipientId: '507f191e810c19729de860ea',
      $or: [
        { createdAt: { $lt: new Date('2026-03-23T10:00:00.000Z') } },
        {
          createdAt: new Date('2026-03-23T10:00:00.000Z'),
          _id: { $lt: '507f191e810c19729de860ef' },
        },
      ],
    })
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1, _id: -1 })
  })

  it('ignora id invalido en cursor compuesto y aplica fallback por fecha', async () => {
    getQueryMock.mockReturnValue({
      cursor: '2026-03-23T10:00:00.000Z|id-invalido',
    })

    limitMock.mockResolvedValueOnce([])
    countDocumentsMock.mockResolvedValueOnce(0)

    const { default: handler } = await import('~~/server/api/notifications/index.get')
    await (handler as (e: unknown) => Promise<unknown>)({})

    expect(findMock).toHaveBeenCalledWith({
      recipientId: '507f191e810c19729de860ea',
      createdAt: { $lt: new Date('2026-03-23T10:00:00.000Z') },
    })
  })
})
