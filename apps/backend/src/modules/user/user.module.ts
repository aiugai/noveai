import { Module } from '@nestjs/common'

import { PrismaModule } from '@/prisma/prisma.module'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { UserAdminController } from './user.admin.controller'

@Module({
  imports: [PrismaModule],
  controllers: [UserController, UserAdminController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
