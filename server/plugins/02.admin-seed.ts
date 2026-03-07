import User from '~~/server/models/User'
import { validateCoreEnv } from '~~/server/utils/env'

export default defineNitroPlugin(async () => {
  const config = validateCoreEnv(useRuntimeConfig())

  const adminExists = await User.findOne({ role: 'admin' }).lean()
  if (adminExists) {
    return
  }

  const hasAdminEmail = config.adminEmail.length > 0
  const hasAdminPassword = config.adminPassword.length > 0

  if (!hasAdminEmail && !hasAdminPassword) {
    return
  }

  await User.create({
    fullName: 'Administrador SIPAc',
    email: config.adminEmail,
    passwordHash: config.adminPassword,
    role: 'admin',
    isActive: true,
  })

  console.info(`[Admin Seed] Usuario administrador creado: ${config.adminEmail}`)
})
