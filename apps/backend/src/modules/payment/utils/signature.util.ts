import { createHmac, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'

/**
 * 支付签名工具类
 *
 * @description
 * 提供 HMAC-SHA256 签名生成和验证功能
 * - 使用 crypto.timingSafeEqual 防止时序攻击
 * - 参数按字典序排序后拼接
 * - 支持排除特定字段(如 sign 字段本身)
 *
 * @example
 * const signature = signatureUtil.sign(params, secretKey)
 * const isValid = signatureUtil.verify(params, secretKey, expectedSignature)
 */
@Injectable()
export class SignatureUtil {
  /**
   * 生成 HMAC-SHA256 签名
   *
   * @param params - 参数对象
   * @param secretKey - 商户密钥
   * @param excludeFields - 需要排除的字段(默认排除 sign 字段)
   * @returns 十六进制签名字符串
   *
   * @example
   * const signature = signatureUtil.sign(
   *   { merchantId: 'test', amount: 100, timestamp: 1234567890 },
   *   'secret-key'
   * )
   */
  sign(
    params: Record<string, any>,
    secretKey: string,
    excludeFields: string[] = ['sign'],
  ): string {
    // 1. 过滤排除字段
    const filteredParams = Object.entries(params).filter(
      ([key]) => !excludeFields.includes(key),
    )

    // 2. 按键名字典序排序
    const sortedParams = filteredParams.sort(([keyA], [keyB]) =>
      keyA.localeCompare(keyB),
    )

    // 3. 拼接为 key1=value1&key2=value2 格式
    const str = sortedParams.map(([key, value]) => `${key}=${value}`).join('&')

    // 4. 计算 HMAC-SHA256
    const hmac = createHmac('sha256', secretKey)
    hmac.update(str)
    return hmac.digest('hex')
  }

  /**
   * 验证 HMAC-SHA256 签名
   *
   * @param params - 参数对象(包含 sign 字段)
   * @param secretKey - 商户密钥
   * @param expectedSignature - 预期的签名(可选,从 params.sign 读取)
   * @returns 签名是否有效
   *
   * @example
   * const isValid = signatureUtil.verify(
   *   { merchantId: 'test', amount: 100, sign: 'xxx' },
   *   'secret-key'
   * )
   */
  verify(
    params: Record<string, any>,
    secretKey: string,
    expectedSignature?: string,
  ): boolean {
    const expected = expectedSignature ?? params.sign
    if (!expected) {
      return false
    }

    // 重新计算签名
    const calculated = this.sign(params, secretKey)

    // 使用常量时间比较防止时序攻击
    try {
      const expectedBuffer = Buffer.from(expected, 'hex')
      const calculatedBuffer = Buffer.from(calculated, 'hex')

      // 长度不同时直接返回 false
      if (expectedBuffer.length !== calculatedBuffer.length) {
        return false
      }

      return timingSafeEqual(expectedBuffer, calculatedBuffer)
    }
    catch {
      // 签名格式错误(非十六进制字符串)
      return false
    }
  }

  /**
   * 验证请求时效性
   *
   * @param timestamp - 请求时间戳(毫秒)
   * @param maxAgeMs - 最大允许时间差(默认5分钟)
   * @returns 时效性是否有效
   *
   * @example
   * const isValid = signatureUtil.verifyTimestamp(Date.now())
   */
  verifyTimestamp(timestamp: number, maxAgeMs: number = 5 * 60 * 1000): boolean {
    const now = Date.now()
    const diff = Math.abs(now - timestamp)
    return diff < maxAgeMs
  }
}
