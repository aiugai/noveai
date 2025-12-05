import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator'
import { SHORT_ID_REGEX } from '@ai/shared'

export function IsShortId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsShortId',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          if (value == null) return true
          if (typeof value !== 'string') return false
          return SHORT_ID_REGEX.test(value)
        },
        defaultMessage(): string {
          return 'must be a valid 6-character short id'
        },
      },
    })
  }
}
