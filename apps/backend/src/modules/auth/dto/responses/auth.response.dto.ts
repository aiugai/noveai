import { ApiProperty } from '@nestjs/swagger'

import { UserProfileResponseDto } from '@/modules/user/dto/responses/user.profile.response.dto'

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string

  @ApiProperty({ type: () => UserProfileResponseDto })
  user: UserProfileResponseDto
}
