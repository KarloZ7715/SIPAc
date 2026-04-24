import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { updateManyMock, deleteManyMock, findOneAndDeleteMock, isValidObjectIdMock } = vi.hoisted(
  () => ({
    updateManyMock: vi.fn(),
    deleteManyMock: vi.fn(),
    findOneAndDeleteMock: vi.fn(),
    isValidObjectIdMock: vi.fn(),
  }),
)

vi.mock('mongoose', () => ({
  default: {
    isValidObjectId: isValidObjectIdMock,
  },
}))

vi.mock('~~/server/models/Notification', () => ({
  default: {
    updateMany: updateManyMock,
    deleteMany: deleteManyMock,
    findOneAndDelete: findOneAndDeleteMock,
  },
}))

describe('notification action endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('requireAuth', () => ({ sub: '507f191e810c19729de860ea' }))
    vi.stubGlobal('createNotFoundError', (resource: string) => {
      const error = new Error(`${resource} not found`)
      Object.assign(error, { statusCode: 404 })
      return error
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marca todas como leidas para el usuario autenticado', async () => {
    updateManyMock.mockResolvedValueOnce({ modifiedCount: 4 })

    const { default: handler } = await import('~~/server/api/notifications/read-all.patch')
    const result = await (handler as (e: unknown) => Promise<{ data: { updatedCount: number } }>)(
      {},
    )

    expect(updateManyMock).toHaveBeenCalledWith(
      {
        recipientId: '507f191e810c19729de860ea',
        isRead: false,
      },
      {
        $set: { isRead: true },
      },
    )
    expect(result.data.updatedCount).toBe(4)
  })

  it('elimina todas las notificaciones del usuario autenticado', async () => {
    deleteManyMock.mockResolvedValueOnce({ deletedCount: 12 })

    const { default: handler } = await import('~~/server/api/notifications/index.delete')
    const result = await (handler as (e: unknown) => Promise<{ data: { deletedCount: number } }>)(
      {},
    )

    expect(deleteManyMock).toHaveBeenCalledWith({ recipientId: '507f191e810c19729de860ea' })
    expect(result.data.deletedCount).toBe(12)
  })

  it('elimina una notificacion por id y reporta si estaba sin leer', async () => {
    isValidObjectIdMock.mockReturnValueOnce(true)
    findOneAndDeleteMock.mockResolvedValueOnce({ isRead: false })

    const { default: handler } = await import('~~/server/api/notifications/[id]/index.delete')
    const result = await (
      handler as (e: { context: { params: { id: string } } }) => Promise<{
        data: { deletedId: string; wasUnread: boolean }
      }>
    )({
      context: { params: { id: '507f191e810c19729de860ef' } },
    })

    expect(findOneAndDeleteMock).toHaveBeenCalledWith({
      _id: '507f191e810c19729de860ef',
      recipientId: '507f191e810c19729de860ea',
    })
    expect(result.data).toEqual({
      deletedId: '507f191e810c19729de860ef',
      wasUnread: true,
    })
  })

  it('rechaza ids invalidos al eliminar una notificacion', async () => {
    isValidObjectIdMock.mockReturnValueOnce(false)

    const { default: handler } = await import('~~/server/api/notifications/[id]/index.delete')

    await expect(
      (handler as (e: { context: { params: { id: string } } }) => Promise<unknown>)({
        context: { params: { id: 'invalido' } },
      }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
