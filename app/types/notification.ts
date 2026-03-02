import { type Types } from 'mongoose'

export const NOTIFICATION_TYPES = [
  'processing_complete',
  'processing_error',
  'verification_update',
  'system',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const RELATED_RESOURCE_KINDS = ['uploaded_file', 'academic_product'] as const
export type RelatedResourceKind = (typeof RELATED_RESOURCE_KINDS)[number]

export interface IRelatedResource {
  kind: RelatedResourceKind
  id: Types.ObjectId
}

export interface INotification {
  _id: Types.ObjectId
  recipientId: Types.ObjectId
  type: NotificationType
  title: string
  message: string
  relatedResource?: IRelatedResource
  isRead: boolean
  emailSent: boolean
  createdAt: Date
}
