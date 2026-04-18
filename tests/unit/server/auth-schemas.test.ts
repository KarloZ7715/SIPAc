import { describe, expect, it } from 'vitest'
import {
  changeEmailSchema,
  registerSchema,
  resendVerificationSchema,
  twoFactorConfirmSchema,
  twoFactorDisableSchema,
  twoFactorVerifySchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '~~/server/utils/schemas/auth'

describe('updateProfileSchema', () => {
  it('acepta nombres estructurados y programa opcional', () => {
    const result = updateProfileSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      middleName: '',
      secondLastName: '',
      program: 'Maestría',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza firstName vacío cuando se envía', () => {
    const result = updateProfileSchema.safeParse({ firstName: '   ' })
    expect(result.success).toBe(false)
  })

  it('permite payloads parciales (solo programa)', () => {
    const result = updateProfileSchema.safeParse({ program: 'Ingeniería' })
    expect(result.success).toBe(true)
  })
})

describe('registerSchema', () => {
  it('requiere al menos firstName+lastName o fullName', () => {
    const missing = registerSchema.safeParse({
      email: 'ada@correo.unicordoba.edu.co',
      password: 'Secret123!',
    })
    expect(missing.success).toBe(false)

    const structured = registerSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@correo.unicordoba.edu.co',
      password: 'Secret123!',
    })
    expect(structured.success).toBe(true)

    const fullOnly = registerSchema.safeParse({
      fullName: 'Ada Lovelace',
      email: 'ada@correo.unicordoba.edu.co',
      password: 'Secret123!',
    })
    expect(fullOnly.success).toBe(true)
  })

  it('normaliza email a minúsculas', () => {
    const result = registerSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ADA@Correo.UniCordoba.Edu.Co',
      password: 'Secret123!',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('ada@correo.unicordoba.edu.co')
    }
  })
})

describe('changeEmailSchema', () => {
  it('requiere contraseña y correo válido', () => {
    expect(changeEmailSchema.safeParse({ password: 'x', newEmail: 'no-email' }).success).toBe(false)
    expect(changeEmailSchema.safeParse({ password: 'x', newEmail: 'new@demo.test' }).success).toBe(
      true,
    )
  })
})

describe('schemas 2FA', () => {
  it('twoFactorVerifySchema requiere código de 6 dígitos y challengeId', () => {
    expect(twoFactorVerifySchema.safeParse({ challengeId: 'x', code: '12345' }).success).toBe(false)
    expect(twoFactorVerifySchema.safeParse({ challengeId: 'x', code: 'abcdef' }).success).toBe(
      false,
    )
    expect(twoFactorVerifySchema.safeParse({ challengeId: 'x', code: '123456' }).success).toBe(true)
  })

  it('twoFactorConfirmSchema valida código', () => {
    expect(twoFactorConfirmSchema.safeParse({ code: '000000' }).success).toBe(true)
    expect(twoFactorConfirmSchema.safeParse({ code: '12' }).success).toBe(false)
  })

  it('twoFactorDisableSchema requiere contraseña y código', () => {
    expect(twoFactorDisableSchema.safeParse({ password: 'secret', code: '000000' }).success).toBe(
      true,
    )
    expect(twoFactorDisableSchema.safeParse({ password: '', code: '000000' }).success).toBe(false)
  })
})

describe('schemas de verificación de email', () => {
  it('verifyEmailSchema exige token no vacío', () => {
    expect(verifyEmailSchema.safeParse({ token: '' }).success).toBe(false)
    expect(verifyEmailSchema.safeParse({ token: 'abc123' }).success).toBe(true)
  })

  it('resendVerificationSchema normaliza email', () => {
    const result = resendVerificationSchema.safeParse({
      email: 'User@Demo.TEST',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@demo.test')
    }
  })
})
