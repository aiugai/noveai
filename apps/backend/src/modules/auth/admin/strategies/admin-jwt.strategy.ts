import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'

import { PrismaService } from '@/prisma/prisma.service'

interface AdminJwtPayload {
  sub: string
  email: string
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret', 'dev_only_secret'),
    })
  }

  async validate(payload: AdminJwtPayload) {
    const admin = await this.prisma.getClient().adminUser.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    })

    if (!admin || admin.isFrozen) {
      return null
    }

    return {
      id: admin.id,
      email: admin.email,
      username: admin.username,
      roles: admin.roles.map(r => r.role),
    }
  }
}
