import { z } from 'zod'
import { USER_ROLES } from '~~/app/types'

export const createUserSchema = z.object({
  fullName: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(120, 'El nombre no puede superar los 120 caracteres')
    .trim(),
  email: z.email({ error: 'Formato de correo electrónico inválido' }).toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede superar los 72 caracteres'),
  role: z.enum(USER_ROLES).optional().default('docente'),
  program: z.string().trim().optional(),
})

export const updateUserSchema = z.object({
  fullName: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(120, 'El nombre no puede superar los 120 caracteres')
    .trim()
    .optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
  program: z.string().trim().optional(),
})
