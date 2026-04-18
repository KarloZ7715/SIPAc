export interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta?: PaginationMeta
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export interface RepositoryFacetCount {
  value: string
  count: number
}

export interface RepositorySearchTelemetry {
  executionMs: number
  sortBy: 'date_desc' | 'date_asc' | 'title_asc' | 'title_desc'
  page: number
  limit: number
  resultCount: number
}

export interface PaginationMeta {
  total: number
  page?: number
  limit: number
  hasMore: boolean
  nextCursor?: string
  facets?: {
    productTypes: RepositoryFacetCount[]
  }
  telemetry?: RepositorySearchTelemetry
}

export interface CursorPaginationParams {
  cursor?: string
  limit?: number
}

export interface OffsetPaginationParams {
  page?: number
  limit?: number
}

export interface ProfileActivityItem {
  _id: string
  action: string
  resource: string
  resourceId?: string
  details?: string
  createdAt: string
}

export interface ProfileSessionItem {
  _id: string
  ipAddress: string
  userAgent?: string
  createdAt: string
  lastSeenAt?: string
  isCurrent: boolean
}

export const PAGINATION = {
  MIN_LIMIT: 10,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const
