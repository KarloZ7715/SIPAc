import { BrevoClient } from '@getbrevo/brevo'
import { validateEnv } from '~~/server/utils/env'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
}

/**
 * Send an email via Brevo transactional API. Returns true if sent, false if not
 * configured (dev fallback to console) or if delivery failed.
 *
 * The sender email must be previously verified in Brevo (Senders & IP → Senders).
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const env = validateEnv(useRuntimeConfig())

  if (!env.brevoApiKey || !env.brevoFromEmail) {
    console.info(`[email] (dev fallback) to=${input.to} subject="${input.subject}"`)
    console.info(input.html)
    return false
  }

  const brevo = new BrevoClient({ apiKey: env.brevoApiKey })

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: input.subject,
      htmlContent: input.html,
      sender: { email: env.brevoFromEmail, name: env.brevoFromName || 'SIPAc' },
      to: [{ email: input.to }],
    })
    return true
  } catch (error) {
    console.error('[email] Error enviando correo:', error)
    return false
  }
}
