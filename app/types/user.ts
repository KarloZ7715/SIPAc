import type { DatabaseId } from './database'
import type { ProductReviewStatus, ProductType } from './academic-product'

export const USER_ROLES = ['admin', 'docente'] as const
export type UserRole = (typeof USER_ROLES)[number]

export interface IUser {
  _id: DatabaseId
  fullName: string
  email: string
  passwordHash: string
  role: UserRole
  isActive: boolean
  program?: string
  failedLoginAttempts: number
  lockUntil?: Date
  passwordResetToken?: string
  passwordResetExpires?: Date
  createdAt: Date
  updatedAt: Date
}

export interface UserPublic {
  _id: string
  fullName: string
  email: string
  role: UserRole
  isActive: boolean
  program?: string
  createdAt: string
}

export interface ProfileSummaryResponse {
  user: UserPublic
  totalOwnProducts: number
  productSummaryByType: Array<{
    productType: ProductType
    total: number
  }>
  latestDrafts: Array<{
    _id: string
    productType: ProductType
    reviewStatus: ProductReviewStatus
    updatedAt: string
    title?: string
  }>
}

export interface CreateUserDTO {
  fullName: string
  email: string
  password: string
  role?: UserRole
  program?: string
}

export interface LoginDTO {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: UserPublic
}

export interface UpdateUserDTO {
  fullName?: string
  role?: UserRole
  isActive?: boolean
  program?: string
}

export interface ChangePasswordDTO {
  currentPassword: string
  newPassword: string
}

export interface ForgotPasswordDTO {
  email: string
}

export interface ResetPasswordDTO {
  token: string
  newPassword: string
}
