import { Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule } from '@nestjs/config'

import { PrismaModule } from '@/prisma/prisma.module'
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy'
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard'

@Module({
  imports: [PrismaModule, PassportModule, ConfigModule],
  providers: [AdminJwtStrategy, AdminJwtAuthGuard],
  exports: [AdminJwtAuthGuard],
})
export class AdminAuthModule {}
