import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { SHORT_ID_REGEX } from '@ai/shared'

/**
 * 验证并转换 ID 参数
 *
 * 支持两种格式：
 * 1. 短 ID：6 位字母数字组合（项目主要使用的格式）
 * 2. CUID：c + 24 位小写字母数字组合（Prisma 默认格式，作为后备）
 */
@Injectable()
export class ParseCuidPipe implements PipeTransform<string> {
  // CUID 格式：c + 24位小写字母数字组合
  private static readonly CUID_REGEX = /^c[0-9a-z]{24}$/

  transform(value: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('Invalid ID format: expected string')
    }

    // 检查短 ID 格式（项目主要使用的格式）
    if (SHORT_ID_REGEX.test(value)) {
      return value
    }

    // 检查 CUID 格式（后备支持）
    const normalized = value.toLowerCase()
    if (ParseCuidPipe.CUID_REGEX.test(normalized)) {
      return normalized
    }

    throw new BadRequestException(
      `Invalid ID format: expected 6-character short ID (e.g., Ab3Cd5) or CUID (e.g., c1a2b3c4d5e6f7g8h9i0j1k2)`,
    )
  }
}
