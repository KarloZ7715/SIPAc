import type { ApiSuccessResponse, PaginationMeta } from '~~/app/types'

export function ok<T>(data: T, meta?: PaginationMeta): ApiSuccessResponse<T> {
  return { success: true, data, ...(meta && { meta }) }
}
