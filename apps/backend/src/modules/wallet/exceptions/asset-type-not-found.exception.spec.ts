import { AssetTypeNotFoundException } from './asset-type-not-found.exception'
import { ErrorCode } from '@ai/shared'

describe('assetTypeNotFoundException', () => {
  it('should create exception with correct error code and args', () => {
    const exception = new AssetTypeNotFoundException({
      assetCode: 'UNKNOWN_ASSET',
    })

    expect(exception.code).toBe(ErrorCode.WALLET_ASSET_TYPE_NOT_FOUND)
    expect(exception.args).toEqual({
      assetCode: 'UNKNOWN_ASSET',
    })
    expect(exception.getStatus()).toBe(404)
    expect(exception.message).toBe('资产类型不存在')
  })

  it('should store assetCode property', () => {
    const exception = new AssetTypeNotFoundException({
      assetCode: 'DIAMOND',
    })

    expect(exception.assetCode).toBe('DIAMOND')
  })
})
