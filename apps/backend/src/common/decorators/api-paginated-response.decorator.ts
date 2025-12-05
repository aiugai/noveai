import { Type, applyDecorators } from '@nestjs/common'
import { ApiOkResponse, getSchemaPath } from '@nestjs/swagger'
import { BasePaginationResponseDto } from '../dto/base.pagination.response.dto'

/**
 * API 分页响应装饰器
 *
 * @description
 * 用于正确生成带泛型的分页响应 Swagger 文档
 * 解决 BasePaginationResponseDto<T> 泛型无法在 Swagger 中正确展开的问题
 *
 * @param model - 分页项的数据模型类
 *
 * @example
 * @ApiOkResponsePaginated(UserActivityStatusResponseDto)
 * async getUserActivityProgress() {
 *   return new BasePaginationResponseDto(..., items)
 * }
 */
export const ApiOkResponsePaginated = <TModel extends Type>(model: TModel) =>
  applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(BasePaginationResponseDto) },
          {
            properties: {
              items: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  )
