import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

export class InvalidSettingTypeException extends DomainException {
  constructor(key: string, expectedType: string, actualType: string) {
    super(`配置 "${key}" 类型错误`, {
      code: ErrorCode.SETTINGS_TYPE_MISMATCH,
      args: { key, expectedType, actualType },
    })
  }
}

export class JsonExpectedObjectOrArrayException extends DomainException {
  constructor(key: string, actualType: string) {
    super(`配置 "${key}" 期望 JSON 对象或数组`, {
      code: ErrorCode.SETTINGS_JSON_EXPECTED_OBJECT_OR_ARRAY,
      args: { key, actualType },
    })
  }
}

