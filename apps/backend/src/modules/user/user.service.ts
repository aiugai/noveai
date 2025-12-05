import { Injectable } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { CredentialType, Prisma, User, UserStatus } from '@prisma/client'

import { PrismaService } from '@/prisma/prisma.service'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'
import {
  AdminCreateUserDto,
  AdminManagedUserDto,
  AdminResetUserPasswordDto,
  AdminUpdateUserDto,
  AdminUserListQueryDto,
  AdminUserListResponseDto,
} from './dto/admin.user.dto'

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(params: { email: string; password: string; nickname?: string | null }) {
    const { email, password, nickname } = params
    return this.prisma.getClient().user.create({
      data: {
        email: email.toLowerCase(),
        password,
        nickname: nickname ?? null,
      },
    })
  }

  async findByEmail(email: string) {
    return this.prisma.getClient().user.findUnique({ where: { email: email.toLowerCase() } })
  }

  async findById(id: string) {
    return this.prisma.getClient().user.findUnique({ where: { id } })
  }

  /**
   * 获取用户当前有效的会员记录（若有多条，取结束时间最晚的一条）
   */
  async findActiveMembership(userId: string) {
    const now = new Date()
    return this.prisma.getClient().userMembership.findFirst({
      where: {
        userId,
        endAt: { gt: now },
      },
      orderBy: { endAt: 'desc' },
    })
  }

  async updatePassword(id: string, password: string) {
    return this.prisma.getClient().user.update({ where: { id }, data: { password } })
  }

  async markEmailVerified(id: string) {
    return this.prisma.getClient().user.update({
      where: { id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })
  }

  async disableUser(id: string) {
    return this.prisma.getClient().user.update({
      where: { id },
      data: { status: UserStatus.suspended },
    })
  }

  async upsertCredential(userId: string, type: CredentialType, value: string) {
    return this.prisma.getClient().userCredential.upsert({
      where: { type_value: { type, value } },
      update: { userId },
      create: { userId, type, value },
    })
  }

  async adminListUsers(query: AdminUserListQueryDto): Promise<AdminUserListResponseDto> {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const normalizedKeyword = query.keyword?.trim()

    const where: Prisma.UserWhereInput = { deletedAt: null }
    if (normalizedKeyword) {
      where.OR = [
        { email: { contains: normalizedKeyword, mode: 'insensitive' } },
        { nickname: { contains: normalizedKeyword, mode: 'insensitive' } },
      ]
    }
    if (query.status) {
      where.status = query.status
    }

    const client = this.prisma.getClient()
    const [total, users] = await Promise.all([
      client.user.count({ where }),
      client.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const items = users.map(user => this.mapAdminUser(user))
    return new AdminUserListResponseDto(total, page, limit, items)
  }

  async adminFindUserById(id: string): Promise<AdminManagedUserDto> {
    const user = await this.prisma.getClient().user.findFirst({ where: { id, deletedAt: null } })
    if (!user) {
      throw new DomainException('User not found', { code: ErrorCode.USER_NOT_FOUND, args: { id } })
    }
    return this.mapAdminUser(user)
  }

  async adminCreateUser(dto: AdminCreateUserDto): Promise<AdminManagedUserDto> {
    const client = this.prisma.getClient()
    const email = dto.email.toLowerCase()
    const exists = await client.user.findUnique({ where: { email } })
    if (exists) {
      throw new DomainException('User already exists', { code: ErrorCode.AUTH_EMAIL_ALREADY_TAKEN, args: { email } })
    }

    const hashed = await bcrypt.hash(dto.password, 10)
    const created = await client.user.create({
      data: {
        email,
        password: hashed,
        nickname: dto.nickname ?? null,
        status: dto.status ?? UserStatus.active,
      },
    })

    await this.upsertCredential(created.id, CredentialType.email, created.email)

    return this.mapAdminUser(created)
  }

  async adminUpdateUser(id: string, dto: AdminUpdateUserDto): Promise<AdminManagedUserDto> {
    const client = this.prisma.getClient()
    const user = await client.user.findUnique({ where: { id } })
    if (!user || user.deletedAt) {
      throw new DomainException('User not found', { code: ErrorCode.USER_NOT_FOUND, args: { id } })
    }

    const data: Prisma.UserUpdateInput = {}
    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase()
      if (email !== user.email) {
        const exists = await client.user.findUnique({ where: { email } })
        if (exists) {
          throw new DomainException('User already exists', {
            code: ErrorCode.AUTH_EMAIL_ALREADY_TAKEN,
            args: { email },
          })
        }
      }
      data.email = email
    }
    if (dto.nickname !== undefined) {
      data.nickname = dto.nickname ?? null
    }
    if (dto.status !== undefined) {
      data.status = dto.status
    }

    const updated = await client.user.update({ where: { id }, data })
    return this.mapAdminUser(updated)
  }

  async adminDeleteUser(id: string): Promise<void> {
    const client = this.prisma.getClient()
    const user = await client.user.findUnique({ where: { id } })
    if (!user || user.deletedAt) {
      throw new DomainException('User not found', { code: ErrorCode.USER_NOT_FOUND, args: { id } })
    }

    await client.user.update({
      where: { id },
      data: {
        status: UserStatus.suspended,
        deletedAt: new Date(),
      },
    })
  }

  async adminResetUserPassword(id: string, dto: AdminResetUserPasswordDto): Promise<void> {
    const client = this.prisma.getClient()
    const user = await client.user.findUnique({ where: { id } })
    if (!user || user.deletedAt) {
      throw new DomainException('User not found', { code: ErrorCode.USER_NOT_FOUND, args: { id } })
    }
    const hashed = await bcrypt.hash(dto.newPassword, 10)
    await this.updatePassword(id, hashed)
  }

  private mapAdminUser(user: User): AdminManagedUserDto {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname ?? null,
      status: user.status,
      emailVerified: user.emailVerified,
      isGuest: user.isGuest,
      guestRequiresBinding: user.guestRequiresBinding,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt ?? null,
    }
  }
}
