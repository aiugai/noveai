import { ApiProperty } from '@nestjs/swagger'

export class UserProfileResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  email: string

  @ApiProperty({ required: false })
  nickname?: string

  @ApiProperty()
  emailVerified: boolean

  @ApiProperty()
  createdAt: Date

  @ApiProperty({
    required: false,
    enum: ['NONE', 'SMALL', 'BIG'],
    description: '当前会员等级（NONE 表示未开通）',
  })
  membershipTier?: 'NONE' | 'SMALL' | 'BIG'

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: '会员到期时间（未开通或已过期则为空）',
  })
  membershipExpireAt?: Date | null
}
