import type { DatabaseId } from './database'

export const NOTIFICATION_TYPES = ['processing_complete', 'processing_error', 'system'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const RELATED_RESOURCE_KINDS = ['uploaded_file', 'academic_product'] as const
export type RelatedResourceKind = (typeof RELATED_RESOURCE_KINDS)[number]

export interface IRelatedResource {
  kind: RelatedResourceKind
  id: DatabaseId
}

export interface INotification {
  _id: DatabaseId
  recipientId: DatabaseId
  type: NotificationType
  title: string
  message: string
  relatedResource?: IRelatedResource
  isRead: boolean
  emailSent: boolean
  createdAt: Date
}

export interface RelatedResourcePublic {
  kind: RelatedResourceKind
  id: string
}

export interface NotificationPublic {
  _id: string
  type: NotificationType
  title: string
  message: string
  relatedResource?: RelatedResourcePublic
  isRead: boolean
  emailSent: boolean
  createdAt: string
}

export interface NotificationListQuery {
  unreadOnly?: boolean
}
