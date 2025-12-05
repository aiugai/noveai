import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator'

import { SCORE_PRICE_HELP_TEXT, isValidScorePrice } from '@ai/shared'

const DEFAULT_MESSAGE_SUFFIX = `格式需要满足：${SCORE_PRICE_HELP_TEXT}`

export function IsScorePrice(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isScorePrice',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === null || value === undefined) return true

          if (typeof value === 'number') {
            return isValidScorePrice(value)
          }

          if (typeof value === 'string') {
            const trimmed = value.trim()
            if (!trimmed) return false
            return isValidScorePrice(trimmed)
          }

          return false
        },
        defaultMessage(args?: ValidationArguments): string {
          const customMessage = validationOptions?.message
          if (typeof customMessage === 'function') {
            return customMessage(args)
          }
          if (typeof customMessage === 'string') {
            return customMessage
          }

          const property = args?.property ?? 'price'
          return `${property}${DEFAULT_MESSAGE_SUFFIX}`
        },
      },
    })
  }
}
