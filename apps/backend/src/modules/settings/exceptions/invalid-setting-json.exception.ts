import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

export class InvalidSettingJsonException extends DomainException {
  constructor(key: string, error: string) {
    super(`配置 "${key}" 的 JSON 解析失败`, {
      code: ErrorCode.SETTINGS_INVALID_JSON,
      args: { key, error },
    })
  }
}

