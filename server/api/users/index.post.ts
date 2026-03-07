import User from '~~/server/models/User'
import { createUserSchema } from '~~/server/utils/schemas/user'

export default defineEventHandler(async (event) => {
  const auth = requireRole(event, 'admin')

  const body = await readBody(event)
  const parsed = createUserSchema.safeParse(body)

  if (!parsed.success) {
    throw createValidationError(parsed.error)
  }

  const { email, password, fullName, role, program } = parsed.data

  const existing = await User.findOne({ email })
  if (existing) {
    throw createConflictError('Ya existe un usuario con ese correo electrónico')
  }

  const user = await User.create({
    fullName,
    email,
    passwordHash: password,
    role,
    program,
  })

  await logAudit(event, {
    userId: auth.sub,
    userName: auth.email,
    action: 'create',
    resource: 'user',
    resourceId: user._id,
    details: `Admin creó usuario ${email} con rol ${role ?? 'docente'}`,
  })

  setResponseStatus(event, 201)
  return ok({ user: user.toJSON() })
})
