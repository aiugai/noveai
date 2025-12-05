import { Controller, Get, UseGuards  } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '@/modules/auth/decorators/current.user.decorator'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt.auth.guard'
import { UserProfileResponseDto } from './dto/responses/user.profile.response.dto'
import { UserService } from './user.service'

@Controller('users')
@ApiTags('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: UserProfileResponseDto })
  async me(@CurrentUser('id') userId: string): Promise<UserProfileResponseDto> {
    const user = await this.userService.findById(userId)
    const membership = await this.userService.findActiveMembership(userId)

    const membershipTier: UserProfileResponseDto['membershipTier'] =
      membership?.tier === 'BIG' || membership?.tier === 'SMALL' ? membership.tier : 'NONE'

    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname || undefined,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      membershipTier,
      membershipExpireAt: membership?.endAt ?? null,
    }
  }
}
