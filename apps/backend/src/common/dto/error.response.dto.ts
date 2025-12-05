import { ApiProperty } from '@nestjs/swagger'
import { ErrorCode } from '@ai/shared'

export class ErrorResponseDetailDto {
  @ApiProperty({ enum: ErrorCode, description: '业务错误码' })
  code!: ErrorCode

  @ApiProperty({
    description: '可选的错误上下文参数',
    required: false,
    type: Object,
  })
  args?: Record<string, unknown>

  @ApiProperty({
    description: '请求追踪 ID',
    required: false,
  })
  requestId?: string
}

export class ErrorResponseDto {
  @ApiProperty({ description: 'HTTP 状态码' })
  status!: number

  @ApiProperty({ type: ErrorResponseDetailDto })
  error!: ErrorResponseDetailDto

  @ApiProperty({ description: '时间戳 (ISO8601)' })
  timestamp!: string

  @ApiProperty({ description: '请求路径' })
  path!: string

  @ApiProperty({ description: '错误信息（非生产环境可见）', required: false })
  message?: string | string[]

  @ApiProperty({
    description: '调试信息，仅在测试/开发环境返回',
    required: false,
    type: Object,
  })
  debug?: Record<string, unknown>
}
