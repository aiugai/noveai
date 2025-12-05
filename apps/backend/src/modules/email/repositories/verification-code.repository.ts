import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { VerificationCodePurpose } from '@prisma/client'

@Injectable()
export class VerificationCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createVerificationCode(data: {
    email: string
    code: string
    purpose: VerificationCodePurpose
    expiresAt: Date
  }) {
    const tx = this.prisma.getClient()
    return tx.verificationCode.create({
      data,
    })
  }

  async findValidCode(email: string, code: string, purpose: VerificationCodePurpose) {
    const tx = this.prisma.getClient()
    return tx.verificationCode.findFirst({
      where: {
        email,
        code,
        purpose,
        expiresAt: {
          gt: new Date(),
        },
        usedAt: null,
      },
    })
  }

  async markAsUsed(id: string) {
    const tx = this.prisma.getClient()
    return tx.verificationCode.update({
      where: { id },
      data: {
        usedAt: new Date(),
      },
    })
  }

  async deleteExpiredCodes() {
    const tx = this.prisma.getClient()
    return tx.verificationCode.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })
  }

  async deleteUserCodes(email: string, purpose?: VerificationCodePurpose) {
    const where: any = { email }
    if (purpose) {
      where.purpose = purpose
    }

    const tx = this.prisma.getClient()
    return tx.verificationCode.deleteMany({
      where,
    })
  }

  async deleteByEmailAndPurpose(email: string, purpose: VerificationCodePurpose) {
    const tx = this.prisma.getClient()
    return tx.verificationCode.deleteMany({
      where: {
        email,
        purpose,
      },
    })
  }

  async verifyCode(
    email: string,
    code: string,
    purpose: VerificationCodePurpose,
    shouldConsumeCode: boolean = true,
  ): Promise<boolean> {
    const verificationCode = await this.findValidCode(email, code, purpose)

    if (!verificationCode) {
      return false
    }

    // Mark the code as used only if requested
    if (shouldConsumeCode) {
      await this.markAsUsed(verificationCode.id)
    }

    return true
  }
}
