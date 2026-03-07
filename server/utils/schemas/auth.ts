import { z } from 'zod'

export const registerSchema = z.object({
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
  program: z.string().trim().optional(),
})

export const loginSchema = z.object({
  email: z.email({ error: 'Formato de correo electrónico inválido' }).toLowerCase().trim(),
  password: z.string().min(1, 'La contraseña es requerida'),
})

export const forgotPasswordSchema = z.object({
  email: z.email({ error: 'Formato de correo electrónico inválido' }).toLowerCase().trim(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'El token es requerido'),
  newPassword: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede superar los 72 caracteres'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(72, 'La nueva contraseña no puede superar los 72 caracteres'),
})

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(120, 'El nombre no puede superar los 120 caracteres')
    .trim()
    .optional(),
})
