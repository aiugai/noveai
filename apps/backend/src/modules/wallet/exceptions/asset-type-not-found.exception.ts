import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 资产类型不存在异常
 *
 * @description
 * 当查询的资产类型代码不存在时抛出此异常
 *
 * @example
 * throw new AssetTypeNotFoundException({
 *   assetCode: 'UNKNOWN_ASSET'
 * })
 */
export class AssetTypeNotFoundException extends DomainException {
  public readonly assetCode: string

  constructor(params: { assetCode: string }) {
    super('Asset type does not exist', {
      code: ErrorCode.WALLET_ASSET_TYPE_NOT_FOUND,
      args: {
        assetCode: params.assetCode,
      },
      status: HttpStatus.NOT_FOUND,
    })

    this.assetCode = params.assetCode
  }
}
