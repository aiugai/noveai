import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { PrismaModule } from '@/prisma/prisma.module'
import { EmailModule } from '@/modules/email/email.module'
import { UserModule } from '@/modules/user/user.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { JwtAuthGuard } from './guards/jwt.auth.guard'

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret', 'dev_only_secret'),
        signOptions: { expiresIn: `${configService.get<number>('jwt.accessExpiration', 2592000)}s` },
      }),
    }),
    EmailModule,
    UserModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
