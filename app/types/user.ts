import type { DatabaseId } from './database'
import type { ProductReviewStatus, ProductType } from './academic-product'

export const USER_ROLES = ['admin', 'docente'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const DEFAULT_LANDING_ROUTES = [
  'dashboard',
  'chat',
  'repository',
  'workspace-documents',
  'profile',
] as const
export type DefaultLandingRoute = (typeof DEFAULT_LANDING_ROUTES)[number]

export interface UserPreferences {
  defaultLanding: DefaultLandingRoute
}

export interface IUser {
  _id: DatabaseId
  fullName: string
  firstName?: string
  middleName?: string
  lastName?: string
  secondLastName?: string
  namesReviewedAt?: Date | null
  email: string
  passwordHash: string
  role: UserRole
  isActive: boolean
  program?: string
  failedLoginAttempts: number
  lockUntil?: Date
  passwordResetToken?: string
  passwordResetExpires?: Date
  lastLoginAt?: Date | null
  preferences?: UserPreferences
  // Security / identity
  tokenVersion: number
  emailVerifiedAt?: Date | null
  emailVerifyToken?: string | null
  emailVerifyExpires?: Date | null
  pendingEmail?: string | null
  pendingEmailToken?: string | null
  pendingEmailExpires?: Date | null
  twoFactorEnabled: boolean
  twoFactorOtpHash?: string | null
  twoFactorOtpExpires?: Date | null
  loginChallengeId?: string | null
  loginChallengeExpires?: Date | null
  googleId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface UserPublic {
  _id: string
  fullName: string
  firstName?: string
  middleName?: string
  lastName?: string
  secondLastName?: string
  namesReviewedAt?: string | null
  email: string
  role: UserRole
  isActive: boolean
  program?: string
  lastLoginAt?: string | null
  preferences?: UserPreferences
  emailVerifiedAt?: string | null
  pendingEmail?: string | null
  twoFactorEnabled?: boolean
  googleId?: string | null
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
  fullName?: string
  firstName?: string
  middleName?: string
  lastName?: string
  secondLastName?: string
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

export interface LoginChallengeResponse {
  requires2FA: true
  challengeId: string
  email: string
}

export interface LoginUnverifiedResponse {
  requiresVerification: true
  email: string
}

export interface UpdateUserDTO {
  fullName?: string
  firstName?: string
  middleName?: string
  lastName?: string
  secondLastName?: string
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
