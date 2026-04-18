import { z } from 'zod'

const namePart = z.string().trim().min(1, 'Requerido').max(60, 'Máximo 60 caracteres')

const optionalNamePart = z
  .string()
  .trim()
  .max(60, 'Máximo 60 caracteres')
  .optional()
  .or(z.literal(''))

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(160, 'El nombre no puede superar los 160 caracteres')
      .trim()
      .optional(),
    firstName: z.string().trim().min(1, 'El primer nombre es obligatorio').max(60).optional(),
    middleName: optionalNamePart,
    lastName: z.string().trim().min(1, 'El primer apellido es obligatorio').max(60).optional(),
    secondLastName: optionalNamePart,
    email: z.email({ error: 'Formato de correo electrónico inválido' }).toLowerCase().trim(),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(72, 'La contraseña no puede superar los 72 caracteres'),
    program: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      // Al menos firstName+lastName O fullName
      const hasStructured = !!data.firstName && !!data.lastName
      const hasFull = !!data.fullName && data.fullName.length >= 3
      return hasStructured || hasFull
    },
    { message: 'Debes indicar al menos primer nombre y primer apellido', path: ['firstName'] },
  )

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
  firstName: namePart.optional(),
  middleName: optionalNamePart,
  lastName: namePart.optional(),
  secondLastName: optionalNamePart,
  program: z.string().trim().max(120).optional().or(z.literal('')),
})

export const changeEmailSchema = z.object({
  password: z.string().min(1, 'La contraseña es requerida'),
  newEmail: z.email({ error: 'Formato de correo electrónico inválido' }).toLowerCase().trim(),
})

export const twoFactorVerifySchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Código inválido'),
})

export const twoFactorConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Código inválido'),
})

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'La contraseña es requerida'),
  code: z.string().regex(/^\d{6}$/, 'Código inválido'),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
})

export const resendVerificationSchema = z.object({
  email: z.email({ error: 'Formato de correo electrónico inválido' }).toLowerCase().trim(),
})
