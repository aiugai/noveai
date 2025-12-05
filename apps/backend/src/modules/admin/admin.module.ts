import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { PrismaModule } from '@/prisma/prisma.module'
import { AdminAuthController } from './controllers/admin-auth.controller'
import { AdminAuthService } from './services/admin-auth.service'
import { AdminUserController } from './controllers/admin-user.controller'
import { AdminUserService } from './services/admin-user.service'
import { RoleController } from './controllers/role.controller'
import { RoleService } from './services/role.service'
import { MenuController } from './controllers/menu.controller'
import { MenuService } from './services/menu.service'
import { PaymentOrdersModule } from './payment-orders/payment-orders.module'

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    PaymentOrdersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret', 'dev_only_secret'),
        signOptions: { expiresIn: `${configService.get<number>('jwt.accessExpiration', 2592000)}s` },
      }),
    }),
  ],
  controllers: [AdminAuthController, AdminUserController, RoleController, MenuController],
  providers: [AdminAuthService, AdminUserService, RoleService, MenuService],
  exports: [AdminAuthService, AdminUserService, RoleService, MenuService],
})
export class AdminModule {}
