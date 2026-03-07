import mongoose, { type Document } from 'mongoose'
import bcrypt from 'bcrypt'
import { USER_ROLES } from '~~/app/types'
import type { IUser } from '~~/app/types'

const { Schema, model, models } = mongoose

export interface IUserMethods {
  isLocked(): boolean
  incrementLoginAttempts(): Promise<void>
  resetLoginAttempts(): Promise<void>
}

export type IUserDocument = Document<unknown, object, IUser> & IUser & IUserMethods

const userSchema = new Schema<IUser, Record<string, never>, IUserMethods>(
  {
    fullName: {
      type: String,
      required: [true, 'El nombre completo es obligatorio'],
      trim: true,
      minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
      maxlength: [120, 'El nombre no puede superar los 120 caracteres'],
    },
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
      enum: {
        values: [...USER_ROLES],
        message: 'El rol {VALUE} no es válido',
      },
      default: 'docente',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    program: {
      type: String,
      trim: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
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
        return ret
      },
    },
  },
)

// --- Indexes ---
userSchema.index({ role: 1, isActive: 1 }, { name: 'idx_role_active' })
userSchema.index({ passwordResetToken: 1 }, { sparse: true, name: 'idx_password_reset' })

// --- Pre-save: hash de contraseña automático ---
userSchema.pre('save', async function (this: IUserDocument) {
  if (!this.isModified('passwordHash')) return
  this.passwordHash = await bcrypt.hash(this.passwordHash, 10)
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

export default models.User || model<IUser>('User', userSchema)
