import { ApiProperty } from '@nestjs/swagger'
import { BackendVersionDto } from './backend-version.dto'

export class HealthCheckResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string

  @ApiProperty({ example: new Date().toISOString() })
  timestamp!: string

  @ApiProperty({ type: BackendVersionDto })
  backendVersion!: BackendVersionDto
}
