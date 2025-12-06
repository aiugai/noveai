'use client'

import Link from 'next/link'
import { CreditCardIcon } from '@heroicons/react/24/outline'
import { AlertTriangle, Headset } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  PaymentService,
  ensureHttpUrl,
  type PaymentMethod,
  type RechargePackageOption,
} from '@/services/payment-service'
import { messageService } from '@/services/message-service'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TooltipProvider } from '@/components/ui/tooltip'

type PaymentMethodKey = PaymentMethod | string

/**
 * 外部支付参数
 */
interface ExternalPaymentParams {
  merchantId: string
  businessOrderId: string
  retUrl: string
  extraData?: string
  timestamp: number
  sign: string
}

// SVG 图标组件
function WechatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="12" fill="#1AAD19" />
      <circle cx="26" cy="28" r="10" fill="white" />
      <circle cx="42" cy="36" r="12" fill="white" />
      <circle cx="22" cy="26" r="2" fill="#1AAD19" />
      <circle cx="30" cy="26" r="2" fill="#1AAD19" />
      <circle cx="38" cy="34" r="2" fill="#1AAD19" />
      <circle cx="46" cy="34" r="2" fill="#1AAD19" />
    </svg>
  )
}

function AlipayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="12" fill="#1677FF" />
      <path
        d="M16 28c4-8 14-12 24-8 6 2 10 6 12 10-4 0-8 0-12 2-6 2-12 6-16 10-2 2-4 4-6 8-2-4-2-10-2-14 0-3 0-6 2-8z"
        fill="white"
        opacity=".95"
      />
      <path d="M20 22h24v6H20z" fill="white" />
      <path d="M26 20h4v20h-4zM34 20h4v20h-4z" fill="white" />
    </svg>
  )
}

function CardSvgIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 5.75A1.75 1.75 0 0 1 4.75 4h14.5A1.75 1.75 0 0 1 21 5.75v12.5A1.75 1.75 0 0 1 19.25 20H4.75A1.75 1.75 0 0 1 3 18.25V5.75Zm1.5 2.5h15V6a.25.25 0 0 0-.25-.25H4.75A.25.25 0 0 0 4.5 6v2.25Zm0 2.5V18c0 .14.11.25.25.25h14.5c.14 0 .25-.11.25-.25v-7.25h-15Zm2.25 4.5h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1 0-1.5Z" />
    </svg>
  )
}

/**
 * 外部充值模式内容组件
 *
 * @description
 * 外部商户跳转到 /recharge 页面时使用此组件
 * - 无需登录
 * - 从 URL 参数获取商户信息和签名
 * - 支付成功后跳转到 ret_url
 */
export function ExternalRechargeContent() {
  const searchParams = useSearchParams()

  // 解析外部支付参数
  const externalParams: ExternalPaymentParams | null = useMemo(() => {
    const merchantId = searchParams.get('merchant_id')
    const businessOrderId = searchParams.get('business_order_id')
    const retUrl = searchParams.get('ret_url')
    const timestamp = searchParams.get('timestamp')
    const sign = searchParams.get('sign')

    if (!merchantId || !businessOrderId || !retUrl || !timestamp || !sign) {
      return null
    }

    return {
      merchantId,
      businessOrderId,
      retUrl, // useSearchParams().get() 已自动解码，无需再次 decodeURIComponent
      extraData: searchParams.get('extra_data') || undefined,
      timestamp: Number(timestamp),
      sign,
    }
  }, [searchParams])

  const [methods, setMethods] = useState<PaymentMethodKey[]>([])
  const [packages, setPackages] = useState<RechargePackageOption[]>([])
  const [creating, setCreating] = useState(false)
  const [exchangeRate, setExchangeRate] = useState<number>(7.2)
  const [error, setError] = useState<string | null>(null)

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const paymentPopupRef = useRef<Window | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
    if (paymentPopupRef.current && !paymentPopupRef.current.closed) {
      paymentPopupRef.current.close()
    }
    paymentPopupRef.current = null
  }, [])

  const [pendingOption, setPendingOption] = useState<RechargePackageOption | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // 设置页面标题
  useEffect(() => {
    document.title = '充值中心'
  }, [])

  // 验证参数
  useEffect(() => {
    if (!externalParams) {
      setError('缺少必要的支付参数，请联系商户')
    }
  }, [externalParams])

  useEffect(() => {
    let mounted = true
    // 外部模式也需要获取支付选项（不需要登录）
    PaymentService.getOptionsPublic()
      .then(res => {
        if (!mounted) return
        const m = Array.isArray(res.methods) ? res.methods : []
        const deduped = Array.from(
          new Set(m.filter((x: unknown) => typeof x === 'string')),
        ) as PaymentMethodKey[]
        setMethods(deduped)

        const packageList = Array.isArray(res.packages) ? res.packages : []
        setPackages(packageList)

        const er = Number(res.exchangeRate)
        if (Number.isFinite(er) && er > 0) setExchangeRate(er)
      })
      .catch(() => {
        setMethods([])
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  const onSelectMobile = useCallback((opt: RechargePackageOption, idx: number) => {
    setSelectedIndex(idx)
    setPendingOption(opt)

    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }

    setDialogOpen(true)
  }, [])

  const iconForMethod = useCallback((m: PaymentMethodKey) => {
    if (m === 'CREDIT_CARD') {
      return <CreditCardIcon className="h-5 w-5 text-[var(--text-primary)]" aria-hidden="true" />
    }
    if (m === 'WECHAT') return <WechatIcon className="h-5 w-5 text-green-500" />
    if (m === 'ALIPAY') return <AlipayIcon className="h-5 w-5 text-sky-500" />
    return <CardSvgIcon className="h-5 w-5 text-[var(--text-primary)]" />
  }, [])

  const displayNameForMethod = useCallback((m: PaymentMethodKey) => {
    if (m === 'WECHAT') return '微信支付'
    if (m === 'ALIPAY') return '支付宝支付'
    if (m === 'CREDIT_CARD') return '信用卡支付'
    return m
  }, [])

  const labelForOption = useCallback((opt: RechargePackageOption): string => {
    if (typeof opt.badgeLabel === 'string' && opt.badgeLabel.length > 0) return opt.badgeLabel
    const bonus = opt.bonusPercent ?? 0
    if (bonus >= 30) return '尊享套餐'
    if (bonus >= 20) return '高阶套餐'
    if (bonus >= 10) return '进阶套餐'
    return '基础套餐'
  }, [])

  const priceInCny = useCallback(
    (opt: RechargePackageOption) => {
      const price = Number(opt.priceAmount)
      if (!Number.isFinite(price)) return opt.priceAmount
      return (price * exchangeRate).toFixed(2)
    },
    [exchangeRate],
  )

  const startOrderPolling = useCallback(
    (orderId: string, popup: Window | null, retUrl: string) => {
      let isChecking = false
      let pollCount = 0
      let consecutiveErrors = 0
      const maxPolls = 300
      const pollIntervalMs = 3000
      const startTime = Date.now()
      const maxDurationMs = 15 * 60 * 1000
      const maxConsecutiveErrors = 5

      stopPolling()
      paymentPopupRef.current = popup ?? null

      const checkOrder = async () => {
        if (isChecking) return
        isChecking = true
        try {
          if (paymentPopupRef.current && paymentPopupRef.current.closed) {
            stopPolling()
            return
          }

          pollCount += 1
          if (pollCount >= maxPolls) {
            stopPolling()
            messageService.info('支付超时，请联系商户查询订单状态')
            return
          }

          if (Date.now() - startTime > maxDurationMs) {
            stopPolling()
            messageService.info('支付超时，请联系商户查询订单状态')
            return
          }

          // 外部模式不需要登录，直接查询订单
          const order = await PaymentService.getOrderByIdPublic(orderId)
          consecutiveErrors = 0

          if (order.status === 'COMPLETED') {
            stopPolling()
            messageService.success('支付成功！正在跳转...')
            // 跳转回商户页面
            setTimeout(() => {
              const url = new URL(retUrl)
              url.searchParams.set('business_order_id', externalParams?.businessOrderId || '')
              url.searchParams.set('status', 'success')
              window.location.href = url.toString()
            }, 1500)
          } else if (order.status === 'FAILED') {
            stopPolling()
            messageService.error('支付失败，请重试')
          }
        } catch {
          consecutiveErrors += 1
          if (consecutiveErrors >= maxConsecutiveErrors) {
            stopPolling()
            messageService.error('订单状态查询失败，请联系商户')
            return
          }
        } finally {
          isChecking = false
        }
      }

      pollingTimerRef.current = setInterval(() => {
        void checkOrder()
      }, pollIntervalMs)

      void checkOrder()
    },
    [stopPolling, externalParams],
  )

  const confirmBuy = useCallback(
    async (_method: PaymentMethodKey) => {
      if (!pendingOption || !externalParams) return
      setSelectedIndex(null)
      setCreating(true)
      try {
        // 调用外部订单创建 API（金额从套餐获取，无需前端传递）
        const result = await PaymentService.createExternalOrder({
          merchantId: externalParams.merchantId,
          businessOrderId: externalParams.businessOrderId,
          retUrl: externalParams.retUrl,
          extraData: externalParams.extraData,
          timestamp: externalParams.timestamp,
          sign: externalParams.sign,
          packageId: pendingOption.id,
        })

        // 从脱敏 DTO 的 payUrl 字段读取支付链接
        // ExternalOrderPublicResponseDto 直接返回 payUrl，不再包含 paymentDetails
        // 使用 ensureHttpUrl 验证协议，防止 javascript:/data: 等伪协议注入
        const redirectUrl = ensureHttpUrl(result.payUrl)
        const orderId = result.id

        // 如果订单已完成（如 Mock 支付直接返回 COMPLETED），立即跳转
        // 与轮询路径保持一致，附加 business_order_id 和 status 参数
        if (result.status === 'COMPLETED') {
          messageService.success?.('支付完成，正在跳转回商户页面')
          setTimeout(() => {
            const url = new URL(externalParams.retUrl)
            url.searchParams.set('business_order_id', externalParams.businessOrderId)
            url.searchParams.set('status', 'success')
            window.location.href = url.toString()
          }, 1000)
          return
        }

        if (redirectUrl) {
          messageService.success?.('下单成功，正在跳转至支付页面')
          const windowName = `payment_${orderId}`
          const popup = window.open(
            redirectUrl,
            windowName,
            'noopener,noreferrer,width=800,height=600',
          )

          if (!popup || popup.closed) {
            messageService.info('浏览器已拦截支付窗口，将在当前页面打开支付链接')
            // 无论是否跳转，都启动轮询以便在用户支付后能正确跳回
            startOrderPolling(orderId, null, externalParams.retUrl)
            setTimeout(() => {
              window.location.href = redirectUrl
            }, 1000)
            return
          }

          startOrderPolling(orderId, popup, externalParams.retUrl)
        } else {
          // 无 payUrl 但订单未完成，启动轮询等待支付完成
          messageService.success?.('下单成功，等待支付确认')
          startOrderPolling(orderId, null, externalParams.retUrl)
        }
      } catch (e: unknown) {
        const friendly = PaymentService.getUserFriendlyMessage?.(e) ?? '下单失败，请稍后重试'
        messageService.error?.(friendly)
      } finally {
        setCreating(false)
        setDialogOpen(false)
        setPendingOption(null)
      }
    },
    [externalParams, pendingOption, startOrderPolling],
  )

  // 错误状态展示
  if (error) {
    return (
      <main className="min-h-dvh md:min-h-screen bg-[#0b1021] flex items-center justify-center">
        <div className="text-center p-8">
          <AlertTriangle className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#e2e8f0] mb-2">参数错误</h1>
          <p className="text-[#94a3b8]">{error}</p>
        </div>
      </main>
    )
  }

  return (
    <TooltipProvider>
      <main className="min-h-dvh md:min-h-screen bg-[#0b1021]">
        <div className="pt-4 pb-40 md:pb-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-[#e2e8f0]">选择充值套餐</h1>
            </div>

            {/* 卡片网格 */}
            {packages.length === 0 ? (
              <div className="border border-dashed border-[#1e293b] rounded-2xl p-8 text-center text-[#94a3b8]">
                暂无可用套餐，请稍后再试
              </div>
            ) : (
              <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                {packages.map((opt, idx) => {
                  const priceCny = priceInCny(opt)
                  const bonusScore =
                    typeof opt.bonusScore === 'number'
                      ? opt.bonusScore
                      : Math.max(0, (opt.totalScore ?? 0) - (opt.baseScore ?? 0))
                  const displayTitle =
                    typeof opt.displayTitle === 'string' && opt.displayTitle.length > 0
                      ? opt.displayTitle
                      : `${opt.totalScore} 积分`

                  const bonusPercent = opt.bonusPercent ?? 0

                  return (
                    <div
                      key={opt.id ?? idx}
                      onClick={() => onSelectMobile(opt, idx)}
                      className="relative min-[480px]:aspect-[4/5] md:aspect-[5/6] cursor-pointer"
                    >
                      {/* 顶部标签 */}
                      <div className="pointer-events-none absolute -left-[6px] top-[8px] z-20 flex items-center justify-center rounded-tr-[16px] rounded-br-[16px] bg-gradient-to-r from-[#6366f1] to-[#9333ea] px-3 py-1.5 md:py-2 shadow-[0_2px_6px_rgba(0,0,0,0.3)]">
                        <div className="max-w-[140px] min-[480px]:max-w-[120px] truncate text-[11px] md:text-xs font-bold text-white text-center">
                          {opt.badgeLabel || labelForOption(opt)}
                        </div>
                      </div>

                      <div
                        className={`
                          relative flex h-full w-full flex-col rounded-tr-[20px] border overflow-hidden
                          border-[#1e293b]/50
                          ${bonusPercent >= 20 ? 'bg-gradient-to-b from-[#1e1b4b]/50 to-[#0f172a]' : 'bg-[#0f172a]'}
                          ${selectedIndex === idx ? 'ring-2 md:ring-[3px] ring-[#6366f1]/80 scale-[1.01] md:scale-[1.02] shadow-md' : 'md:hover:scale-[1.005] md:hover:shadow-md'}
                          shadow-sm cursor-pointer md:cursor-default transition-all duration-200 ease-out active:scale-[0.98] md:active:scale-100
                        `}
                      >
                        {/* 中部主视觉 */}
                        <div className="flex flex-1 flex-col items-center px-3 pb-2 pt-3 md:px-4 md:pt-8 md:pb-2">
                          <div className="flex flex-col items-center w-full flex-shrink-0">
                            <img
                              src="https://prod.ugirl.ai/icons/jifen.png"
                              alt="积分图标"
                              className="w-12 min-[480px]:w-14 md:w-16 h-12 min-[480px]:h-14 md:h-16 object-contain mx-auto mb-1 mt-0 md:mt-2"
                            />

                            {/* 赠送比例高亮文案 */}
                            {bonusPercent >= 10 ? (
                              <div
                                className="relative mt-0.5 mb-0 mx-2 px-2 py-0.5 rounded-lg
                                  bg-gradient-to-r from-red-500/15 via-red-400/20 to-red-500/15
                                  backdrop-blur-sm border border-red-400/30"
                              >
                                <div
                                  className="text-center
                                    text-sm md:text-base
                                    font-extrabold
                                    bg-gradient-to-r from-red-300 via-red-400 to-red-300
                                    bg-clip-text text-transparent
                                    leading-tight"
                                >
                                  {bonusPercent >= 30
                                    ? '额外 30% 赠送'
                                    : bonusPercent >= 20
                                      ? '额外 20% 赠送'
                                      : '额外 10% 赠送'}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-0.5 mb-0 h-[24px] opacity-0 select-none" />
                            )}
                          </div>

                          {/* 下部区域：说明文字 */}
                          <div className="mt-auto pt-1 text-center text-sm md:text-base font-bold text-[#e2e8f0]">
                            {displayTitle}
                            <span
                              className={`block mt-0.5 text-[10px] md:text-[11px] ${
                                bonusScore > 0 ? 'text-[#e2e8f0]' : 'opacity-0 select-none'
                              }`}
                            >
                              含赠送 {bonusScore > 0 ? bonusScore : 0} 积分
                            </span>
                          </div>
                        </div>

                        {/* 底部价格区域 */}
                        <div
                          className="mt-auto flex items-center justify-center
                            bg-gradient-to-b from-[#6366f1]/6 to-[#6366f1]/10
                            border-t border-[#6366f1]/15
                            px-3 py-2.5 md:py-3 backdrop-blur-sm"
                        >
                          <div className="text-lg md:text-xl font-black text-[#e2e8f0] drop-shadow-sm">
                            ¥{priceCny}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 桌面端支付方式 */}
            <div className="hidden md:block mt-8">
              <div className="text-base font-medium mb-3 text-[#e2e8f0]">
                支付方式{pendingOption ? '' : '（请先选择套餐）'}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {methods.map(m => (
                  <Button
                    key={`desktop-inline-${m}`}
                    variant="outline"
                    disabled={creating || !pendingOption}
                    onClick={() => {
                      if (!pendingOption) {
                        messageService.info('请先选择套餐')
                        return
                      }
                      setDialogOpen(true)
                    }}
                    className="h-11 flex items-center justify-center gap-2 bg-[#6366f1]/10 hover:bg-[#6366f1]/20 border-[#1e293b]"
                  >
                    {iconForMethod(m)}
                    <span>{displayNameForMethod(m)}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 说明区 */}
            <div className="mt-6 md:mt-8 rounded-xl border border-[#1e293b] bg-[#0f172a] p-4 text-xs md:text-sm text-[#94a3b8]">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-3 text-yellow-400" />
                <p>温馨提示：</p>
              </div>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li>
                  选中充值套餐后，点击上方支付方式即可跳转至支付页面。充值的积分一般5分钟内会到账。
                </li>
                <li>支付成功后将自动跳转回商户页面。</li>
                <li>如遇问题，请及时联系商户客服。</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 支付方式选择弹窗 */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent
            className="max-w-sm w-[90vw] rounded-2xl bg-[#0f172a]/95 backdrop-blur-xl border-[#1e293b]/20 shadow-2xl overflow-hidden gap-0 p-0"
            hideCloseButton
          >
            <div
              className="relative p-6 pb-6 text-white overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)',
              }}
            >
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white rounded-full blur-3xl" />
                <div className="absolute bottom-[-20%] left-[-10%] w-32 h-32 bg-yellow-300 rounded-full blur-3xl" />
              </div>

              <DialogHeader className="relative z-10 space-y-3">
                <DialogTitle className="text-center text-xl font-bold text-white">
                  选择支付方式
                </DialogTitle>
                <DialogDescription className="text-center text-white/90 text-sm">
                  {pendingOption
                    ? `支付 ¥${priceInCny(pendingOption)} 购买 ${pendingOption.displayTitle}`
                    : '请选择支付方式'}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-6 space-y-4 bg-[#0f172a]">
              <div className="grid grid-cols-1 gap-3">
                {methods.map(m => (
                  <Button
                    key={m}
                    variant="outline"
                    disabled={creating}
                    onClick={() => confirmBuy(m)}
                    className="w-full h-12 flex items-center justify-between px-4 text-base font-medium border border-[#1e293b] hover:border-[#6366f1] hover:bg-[#6366f1]/5 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      {iconForMethod(m)}
                      <span className="text-[#e2e8f0]">{displayNameForMethod(m)}</span>
                    </div>
                    <div className="text-[#94a3b8] text-sm">去支付 &gt;</div>
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 右下角固定客服入口 */}
        <div className="fixed right-4 z-50" style={{ bottom: '25%' }}>
          <Link
            href="https://t.me/xiaott054_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 text-[#6366f1] hover:text-[#6366f1]/80 transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-[#6366f1]/10 hover:bg-[#6366f1]/20 flex items-center justify-center shadow transition-colors">
              <Headset className="h-4.5 w-4.5 text-[#6366f1]" />
            </div>
            <div className="text-xs">客服</div>
          </Link>
        </div>

      </main>
    </TooltipProvider>
  )
}
