import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

/**
 * 校验区间合法性的装饰器
 * 确保 min <= max（当两者都存在时）
 */
@ValidatorConstraint({ name: 'isValidRange', async: false })
export class IsValidRangeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as Record<string, unknown>
    const [minProperty, maxProperty] = args.constraints

    const minValue = obj[minProperty]
    const maxValue = obj[maxProperty]

    // 如果任一值不存在，跳过校验
    if (minValue === undefined || minValue === null) return true
    if (maxValue === undefined || maxValue === null) return true

    // 如果都是字符串，尝试转为数值比较（用于 Decimal 类型）
    if (typeof minValue === 'string' && typeof maxValue === 'string') {
      const minNum = Number(minValue)
      const maxNum = Number(maxValue)
      if (!Number.isNaN(minNum) && !Number.isNaN(maxNum)) {
        return minNum <= maxNum
      }
    }

    // 如果都是数值，直接比较
    if (typeof minValue === 'number' && typeof maxValue === 'number') {
      return minValue <= maxValue
    }

    // 其他类型（如 Date 字符串）使用默认比较
    return minValue <= maxValue
  }

  defaultMessage(args: ValidationArguments): string {
    const [minProperty, maxProperty] = args.constraints
    return `${minProperty} must be less than or equal to ${maxProperty}`
  }
}

/**
 * 区间校验装饰器
 * @param minProperty 最小值字段名
 * @param maxProperty 最大值字段名
 * @param validationOptions 校验选项
 */
export function IsValidRange(
  minProperty: string,
  maxProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [minProperty, maxProperty],
      validator: IsValidRangeConstraint,
    })
  }
}

