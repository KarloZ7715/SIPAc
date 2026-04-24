import { beforeEach, describe, expect, it, vi } from 'vitest'

const { userFindByIdMock, notificationCreateMock, sendEmailMock } = vi.hoisted(() => ({
  userFindByIdMock: vi.fn(),
  notificationCreateMock: vi.fn(),
  sendEmailMock: vi.fn(),
}))

vi.mock('~~/server/models/User', () => ({
  default: {
    findById: userFindByIdMock,
  },
}))

vi.mock('~~/server/models/Notification', () => ({
  default: {
    create: notificationCreateMock,
  },
}))

vi.mock('~~/server/services/email/send-email', () => ({
  sendEmail: sendEmailMock,
}))

describe('notifyDocumentProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('crea notificacion in-app sin enviar correo', async () => {
    userFindByIdMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: 'u1' }),
      }),
    })

    const { notifyDocumentProcessing } =
      await import('~~/server/services/notifications/notify-document-processing')

    await notifyDocumentProcessing({
      recipientId: '507f191e810c19729de860ea',
      uploadedFileId: '507f191e810c19729de860eb',
      filename: 'tesis.pdf',
      status: 'completed',
    })

    expect(notificationCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: '507f191e810c19729de860ea',
        type: 'processing_complete',
        title: 'Documento procesado correctamente',
        emailSent: false,
        relatedResource: {
          kind: 'uploaded_file',
          id: '507f191e810c19729de860eb',
        },
      }),
    )
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('no crea notificacion si el destinatario no existe', async () => {
    userFindByIdMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    })

    const { notifyDocumentProcessing } =
      await import('~~/server/services/notifications/notify-document-processing')

    await notifyDocumentProcessing({
      recipientId: '507f191e810c19729de860ea',
      uploadedFileId: '507f191e810c19729de860eb',
      filename: 'tesis.pdf',
      status: 'error',
      errorMessage: 'OCR timeout',
    })

    expect(notificationCreateMock).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
