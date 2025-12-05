import { ApiProperty } from '@nestjs/swagger'

export class BackendRuntimeInfoDto {
  @ApiProperty({ example: process.version })
  node!: string

  @ApiProperty({ example: '11.1.5', required: false })
  nest?: string

  @ApiProperty({ example: '6.16.1', required: false })
  prisma?: string
}

export class BackendVersionDto {
  @ApiProperty({ example: '@ai/backend' })
  app!: string

  @ApiProperty({ example: '0.1.0' })
  version!: string

  @ApiProperty({ example: 'abcdef0123456789', required: false })
  gitSha?: string

  @ApiProperty({ example: 'abcdef0', required: false })
  gitShortSha?: string

  @ApiProperty({ example: '2025-09-16T00:00:00.000Z', required: false })
  buildTime?: string

  @ApiProperty({ type: BackendRuntimeInfoDto })
  runtime!: BackendRuntimeInfoDto

  @ApiProperty({ example: 'production', required: false })
  environment?: string
}
