import { Resend } from 'resend'
import type { NotificationType } from '~~/app/types'
import Notification from '~~/server/models/Notification'
import User from '~~/server/models/User'
import { validateEnv } from '~~/server/utils/env'

interface NotifyDocumentProcessingInput {
  recipientId: string
  uploadedFileId: string
  academicProductId?: string
  filename: string
  status: 'completed' | 'error'
  errorMessage?: string
}

function buildNotificationContent(input: NotifyDocumentProcessingInput): {
  type: NotificationType
  title: string
  message: string
} {
  if (input.status === 'completed') {
    return {
      type: 'processing_complete',
      title: 'Documento procesado correctamente',
      message: `El documento ${input.filename} fue procesado y agregado al repositorio.`,
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
  const env = validateEnv(useRuntimeConfig())

  if (!env.resendApiKey || !env.resendFromEmail) {
    return false
  }

  const resend = new Resend(env.resendApiKey)

  try {
    await resend.emails.send({
      from: env.resendFromEmail,
      to: input.to,
      subject: input.title,
      html: `<p>Hola ${input.fullName},</p><p>${input.message}</p><p>SIPAc</p>`,
    })
    return true
  } catch (error) {
    console.error('[Notifications] Error al enviar correo:', error)
    return false
  }
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
