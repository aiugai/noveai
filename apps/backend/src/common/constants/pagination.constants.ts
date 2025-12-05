/**
 * 分页相关常量
 * @deprecated 请使用 @ai/shared 中的 PAGINATION_LIMITS
 * 保留此文件以保持向后兼容，但应逐步迁移到 @ai/shared
 */
import { PAGINATION_LIMITS } from '@ai/shared'

export const PAGINATION_CONSTANTS = {
  /** 默认每页数量 */
  DEFAULT_PAGE_SIZE: PAGINATION_LIMITS.DEFAULT_PAGE_SIZE,
  /** 最大每页数量（性能考虑） */
  MAX_PAGE_SIZE: PAGINATION_LIMITS.MAX_PAGE_SIZE,
} as const
