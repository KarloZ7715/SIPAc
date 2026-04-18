import mongoose, { type Document } from 'mongoose'
import bcrypt from 'bcrypt'
import { DEFAULT_LANDING_ROUTES, USER_ROLES } from '~~/app/types'
import type { IUser } from '~~/app/types'
import { buildFullName } from '~~/server/utils/full-name'

const { Schema, model, models } = mongoose

export interface IUserMethods {
  isLocked(): boolean
  incrementLoginAttempts(): Promise<void>
  resetLoginAttempts(): Promise<void>
}

export type IUserDocument = Document<unknown, object, IUser> & IUser & IUserMethods
type UserModel = mongoose.Model<IUser, Record<string, never>, IUserMethods>

const userSchema = new Schema<IUser, Record<string, never>, IUserMethods>(
  {
    fullName: {
      type: String,
      required: [true, 'El nombre completo es obligatorio'],
      trim: true,
      minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
      maxlength: [160, 'El nombre no puede superar los 160 caracteres'],
    },
    firstName: { type: String, trim: true, default: null },
    middleName: { type: String, trim: true, default: null },
    lastName: { type: String, trim: true, default: null },
    secondLastName: { type: String, trim: true, default: null },
    namesReviewedAt: { type: Date, default: null },
    email: {
      type: String,
      required: [true, 'El correo electrónico es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Formato de correo electrónico inválido'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: { values: [...USER_ROLES], message: 'El rol {VALUE} no es válido' },
      default: 'docente',
    },
    isActive: { type: Boolean, default: true },
    program: { type: String, trim: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLoginAt: { type: Date, default: null },
    preferences: {
      type: new Schema(
        {
          defaultLanding: {
            type: String,
            enum: [...DEFAULT_LANDING_ROUTES],
            default: 'dashboard',
          },
        },
        { _id: false },
      ),
      default: () => ({ defaultLanding: 'dashboard' }),
    },
    // --- Security / identity ---
    tokenVersion: { type: Number, default: 0 },
    emailVerifiedAt: { type: Date, default: null },
    emailVerifyToken: { type: String, select: false, default: null },
    emailVerifyExpires: { type: Date, select: false, default: null },
    pendingEmail: { type: String, lowercase: true, trim: true, default: null },
    pendingEmailToken: { type: String, select: false, default: null },
    pendingEmailExpires: { type: Date, select: false, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorOtpHash: { type: String, select: false, default: null },
    twoFactorOtpExpires: { type: Date, select: false, default: null },
    loginChallengeId: { type: String, select: false, default: null },
    loginChallengeExpires: { type: Date, select: false, default: null },
    googleId: { type: String, trim: true, sparse: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash
        delete ret.__v
        delete ret.failedLoginAttempts
        delete ret.lockUntil
        delete ret.passwordResetToken
        delete ret.passwordResetExpires
        delete ret.emailVerifyToken
        delete ret.emailVerifyExpires
        delete ret.pendingEmailToken
        delete ret.pendingEmailExpires
        delete ret.twoFactorOtpHash
        delete ret.twoFactorOtpExpires
        delete ret.loginChallengeId
        delete ret.loginChallengeExpires
        return ret
      },
    },
  },
)

// --- Indexes ---
userSchema.index({ role: 1, isActive: 1 }, { name: 'idx_role_active' })
userSchema.index({ passwordResetToken: 1 }, { sparse: true, name: 'idx_password_reset' })
userSchema.index({ emailVerifyToken: 1 }, { sparse: true, name: 'idx_email_verify' })
userSchema.index({ pendingEmailToken: 1 }, { sparse: true, name: 'idx_pending_email' })
userSchema.index({ googleId: 1 }, { sparse: true, unique: true, name: 'idx_google_id' })

// --- Pre-save: hash password + rebuild fullName when structured parts change ---
userSchema.pre('save', async function (this: IUserDocument) {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 10)
  }

  const structuredModified =
    this.isModified('firstName') ||
    this.isModified('middleName') ||
    this.isModified('lastName') ||
    this.isModified('secondLastName')

  if (structuredModified) {
    const rebuilt = buildFullName({
      firstName: this.firstName,
      middleName: this.middleName,
      lastName: this.lastName,
      secondLastName: this.secondLastName,
      fallback: this.fullName,
    })
    if (rebuilt) {
      this.fullName = rebuilt
    }
  }
})

// --- Instance Methods ---
userSchema.methods.isLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date())
}

userSchema.methods.incrementLoginAttempts = async function (this: IUserDocument) {
  if (this.lockUntil && this.lockUntil < new Date()) {
    this.failedLoginAttempts = 1
    this.lockUntil = undefined as unknown as Date
    await this.save()
    return
  }

  this.failedLoginAttempts += 1

  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000)
  }

  await this.save()
}

userSchema.methods.resetLoginAttempts = async function (this: IUserDocument) {
  this.failedLoginAttempts = 0
  this.lockUntil = undefined as unknown as Date
  await this.save()
}

const User = (models.User as UserModel | undefined) || model<IUser, UserModel>('User', userSchema)

export default User
