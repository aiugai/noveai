import { Transform } from 'class-transformer'
import sanitizeHtml from 'sanitize-html'

/**
 * HTML 清理选项
 */
export interface SanitizeHtmlOptions {
  /** 是否允许基本的 HTML 标签（如 <b>, <i>, <u>） */
  allowBasicTags?: boolean
  /** 是否保留换行符 */
  preserveNewlines?: boolean
  /** 最大长度限制 */
  maxLength?: number
  /** 自定义 sanitize-html 选项 */
  customOptions?: sanitizeHtml.IOptions
}

/**
 * 获取严格的清理选项（不允许任何 HTML）
 */
function getStrictOptions(): sanitizeHtml.IOptions {
  return {
    allowedTags: [],
    allowedAttributes: {},
    allowedSchemes: [],
    allowedSchemesByTag: {},
    allowedSchemesAppliedToAttributes: [],
    allowProtocolRelative: false,
    enforceHtmlBoundary: false,
    parseStyleAttributes: false,
    // 不转义文本内容，只移除HTML标签
    textFilter: (text: string) => text,
  }
}

/**
 * 获取宽松的清理选项（允许基本格式化标签）
 */
function getLenientOptions(): sanitizeHtml.IOptions {
  return {
    allowedTags: ['b', 'i', 'u', 'strong', 'em', 'br'],
    allowedAttributes: {},
    allowedSchemes: [],
    allowedSchemesByTag: {},
    allowedSchemesAppliedToAttributes: [],
    allowProtocolRelative: false,
    enforceHtmlBoundary: false,
    parseStyleAttributes: false,
    // 移除空标签
    exclusiveFilter: frame => {
      return frame.tag && !frame.text.trim()
    },
  }
}

/**
 * 清理 HTML 内容，防止 XSS 攻击
 * @param value 要清理的字符串
 * @param options 清理选项
 * @returns 清理后的安全字符串
 */
function sanitizeHtmlContent(value: string, options: SanitizeHtmlOptions = {}): string {
  if (typeof value !== 'string') {
    return value
  }

  let sanitized: string

  // 对于严格模式，如果没有HTML标签，直接返回原文本避免转义
  if (!options.allowBasicTags && !options.customOptions) {
    // 检查是否包含真正的HTML标签（必须有标签名）
    const hasHtmlTags = /<[a-z][^>]*>/i.test(value)
    if (!hasHtmlTags) {
      // 没有HTML标签，直接处理文本
      sanitized = value
    } else {
      // 有HTML标签，使用sanitize-html清理
      const sanitizeOptions = getStrictOptions()
      sanitized = sanitizeHtml(value, sanitizeOptions)
    }
  } else {
    // 使用自定义选项或宽松选项
    let sanitizeOptions: sanitizeHtml.IOptions
    if (options.customOptions) {
      sanitizeOptions = options.customOptions
    } else {
      sanitizeOptions = getLenientOptions()
    }
    sanitized = sanitizeHtml(value, sanitizeOptions)
  }

  // 处理换行符
  if (!options.preserveNewlines) {
    // 将换行符转换为空格
    sanitized = sanitized.replace(/[\r\n]+/g, ' ')
  } else {
    // 标准化换行符
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  }

  // 清理多余的空白字符
  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  // 长度限制
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength).trim()
  }

  return sanitized
}

/**
 * HTML 清理装饰器
 * 使用成熟的 sanitize-html 库自动清理输入中的 HTML 内容，防止 XSS 攻击
 *
 * @param options 清理选项
 * @returns Transform 装饰器
 *
 * @example
 * ```typescript
 * class CreatePostDto {
 *   @SanitizeHtml({ maxLength: 100 })
 *   @IsString()
 *   title: string
 *
 *   @SanitizeHtml({ allowBasicTags: true, preserveNewlines: true })
 *   @IsString()
 *   content: string
 * }
 * ```
 */
export function SanitizeHtml(options: SanitizeHtmlOptions = {}) {
  return Transform(({ value }) => {
    if (value == null) return value
    if (typeof value !== 'string') return value
    return sanitizeHtmlContent(value, options)
  })
}

/**
 * 严格的 HTML 清理装饰器
 * 移除所有 HTML 标签和潜在危险内容
 *
 * @param maxLength 最大长度限制
 */
export function SanitizeHtmlStrict(maxLength?: number) {
  return SanitizeHtml({
    allowBasicTags: false,
    preserveNewlines: false,
    maxLength,
  })
}

/**
 * 宽松的 HTML 清理装饰器
 * 允许基本的格式化标签，保留换行符
 *
 * @param maxLength 最大长度限制
 */
export function SanitizeHtmlLenient(maxLength?: number) {
  return SanitizeHtml({
    allowBasicTags: true,
    preserveNewlines: true,
    maxLength,
  })
}

/**
 * 自定义 HTML 清理装饰器
 * 使用自定义的 sanitize-html 选项
 *
 * @param customOptions 自定义 sanitize-html 选项
 * @param maxLength 最大长度限制
 */
export function SanitizeHtmlCustom(customOptions: sanitizeHtml.IOptions, maxLength?: number) {
  return SanitizeHtml({
    customOptions,
    maxLength,
  })
}

// 导出工具函数供测试使用
export { getLenientOptions, getStrictOptions, sanitizeHtmlContent }
