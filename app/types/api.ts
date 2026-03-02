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

export interface PaginationMeta {
  total: number
  page?: number
  limit: number
  hasMore: boolean
  nextCursor?: string
}

export interface CursorPaginationParams {
  cursor?: string
  limit?: number
}

export interface OffsetPaginationParams {
  page?: number
  limit?: number
}

export const PAGINATION = {
  MIN_LIMIT: 10,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
} as const
