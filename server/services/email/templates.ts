function appUrl(): string {
  return process.env.NUXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000'
}

function baseLayout(innerHtml: string): string {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#faf9f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2418;">
  <div style="max-width:520px;margin:32px auto;padding:32px;background:#ffffff;border-radius:16px;border:1px solid #e6dec9;">
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;margin-bottom:24px;">SIPAc</div>
    ${innerHtml}
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;">
    <div style="font-size:12px;color:#8a7f66;">Sistema Inteligente de Productividad Académica · Universidad de Córdoba</div>
  </div>
</body>
</html>`
}

export function verifyEmailTemplate(input: { fullName: string; token: string }): {
  subject: string
  html: string
} {
  const link = `${appUrl()}/verify-email?token=${encodeURIComponent(input.token)}`
  const html = baseLayout(`
    <h1 style="font-size:22px;margin:0 0 16px;">Confirma tu correo institucional</h1>
    <p style="font-size:15px;line-height:1.6;">Hola ${input.fullName}, gracias por crear tu cuenta en SIPAc. Para activarla necesitamos verificar tu correo.</p>
    <p style="margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#8a4a2b;color:#faf9f5;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;">Verificar mi correo</a>
    </p>
    <p style="font-size:13px;color:#5b5342;">O copia y pega este enlace en tu navegador:<br><code style="font-size:12px;">${link}</code></p>
    <p style="font-size:13px;color:#5b5342;">El enlace expira en 24 horas. Si no creaste esta cuenta, puedes ignorar el correo.</p>
  `)
  return { subject: 'Confirma tu correo en SIPAc', html }
}

export function changeEmailTemplate(input: { fullName: string; token: string; newEmail: string }): {
  subject: string
  html: string
} {
  const link = `${appUrl()}/profile/confirm-email?token=${encodeURIComponent(input.token)}`
  const html = baseLayout(`
    <h1 style="font-size:22px;margin:0 0 16px;">Confirma tu nuevo correo</h1>
    <p style="font-size:15px;line-height:1.6;">Hola ${input.fullName}, solicitaste cambiar tu correo en SIPAc a <strong>${input.newEmail}</strong>.</p>
    <p style="margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#8a4a2b;color:#faf9f5;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;">Confirmar nuevo correo</a>
    </p>
    <p style="font-size:13px;color:#5b5342;">Al confirmar cerraremos todas tus sesiones activas por seguridad. El enlace expira en 1 hora.</p>
  `)
  return { subject: 'Confirma el cambio de correo en SIPAc', html }
}

export function otpLoginTemplate(input: { fullName: string; code: string }): {
  subject: string
  html: string
} {
  const html = baseLayout(`
    <h1 style="font-size:22px;margin:0 0 16px;">Tu código de verificación</h1>
    <p style="font-size:15px;line-height:1.6;">Hola ${input.fullName}, alguien (esperamos que tú) está intentando iniciar sesión en SIPAc.</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:0.3em;background:#f5efe2;padding:20px;border-radius:12px;text-align:center;margin:24px 0;">${input.code}</p>
    <p style="font-size:13px;color:#5b5342;">El código expira en 5 minutos. Si no fuiste tú, cambia tu contraseña inmediatamente.</p>
  `)
  return { subject: 'Código de verificación SIPAc', html }
}

export function otpEnableTemplate(input: { fullName: string; code: string }): {
  subject: string
  html: string
} {
  const html = baseLayout(`
    <h1 style="font-size:22px;margin:0 0 16px;">Activa la verificación en dos pasos</h1>
    <p style="font-size:15px;line-height:1.6;">Hola ${input.fullName}, usa este código para confirmar la activación del factor de dos pasos.</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:0.3em;background:#f5efe2;padding:20px;border-radius:12px;text-align:center;margin:24px 0;">${input.code}</p>
    <p style="font-size:13px;color:#5b5342;">El código expira en 10 minutos.</p>
  `)
  return { subject: 'Activa 2FA en SIPAc', html }
}
