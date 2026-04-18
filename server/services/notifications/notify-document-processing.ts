import type { NotificationType } from '~~/app/types'
import Notification from '~~/server/models/Notification'
import User from '~~/server/models/User'
import { sendEmail } from '~~/server/services/email/send-email'

interface NotifyDocumentProcessingInput {
  recipientId: string
  uploadedFileId: string
  academicProductId?: string
  filename: string
  status: 'completed' | 'error'
  errorMessage?: string
  warningMessage?: string
}

function buildNotificationContent(input: NotifyDocumentProcessingInput): {
  type: NotificationType
  title: string
  message: string
} {
  if (input.status === 'completed') {
    const message = input.warningMessage
      ? `El documento ${input.filename} fue procesado y agregado al repositorio con observaciones: ${input.warningMessage}`
      : `El documento ${input.filename} fue procesado y agregado al repositorio.`

    return {
      type: 'processing_complete',
      title: input.warningMessage
        ? 'Documento procesado con observaciones'
        : 'Documento procesado correctamente',
      message,
    }
  }

  return {
    type: 'processing_error',
    title: 'Fallo en el procesamiento del documento',
    message: `El documento ${input.filename} no pudo procesarse. Motivo: ${input.errorMessage ?? 'Error no especificado'}`,
  }
}

async function sendNotificationEmail(input: {
  to: string
  fullName: string
  title: string
  message: string
}): Promise<boolean> {
  return sendEmail({
    to: input.to,
    subject: input.title,
    html: `<p>Hola ${input.fullName},</p><p>${input.message}</p><p>SIPAc</p>`,
  })
}

export async function notifyDocumentProcessing(
  input: NotifyDocumentProcessingInput,
): Promise<void> {
  const recipient = await User.findById(input.recipientId).select('fullName email').lean()
  if (!recipient) {
    return
  }

  const content = buildNotificationContent(input)

  const notification = await Notification.create({
    recipientId: input.recipientId,
    type: content.type,
    title: content.title,
    message: content.message,
    relatedResource: input.academicProductId
      ? { kind: 'academic_product', id: input.academicProductId }
      : { kind: 'uploaded_file', id: input.uploadedFileId },
    emailSent: false,
  })

  const emailSent = await sendNotificationEmail({
    to: recipient.email,
    fullName: recipient.fullName,
    title: content.title,
    message: content.message,
  })

  if (emailSent) {
    notification.emailSent = true
    await notification.save()
  }
}
