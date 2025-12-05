'use client'

import Link from 'next/link'
import { CreditCardIcon } from '@heroicons/react/24/outline'
import { AlertTriangle, Headset, Info } from 'lucide-react'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  PaymentService,
  type PaymentMethod,
  type RechargePackageOption,
} from '@/services/payment-service'
import { messageService } from '@/services/message-service'
import { useAuth } from '@/lib/auth-context'
import { AuthGuard } from '@/components/auth-guard'
import {
  Dialog,
  DialogFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice'
import { ExternalRechargeContent } from './external-recharge-content'

type PaymentMethodKey = PaymentMethod | string

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
 * 路由组件 - 处理外部/内部模式切换
 * 使用 Suspense 包装 useSearchParams 以避免 hydration 问题
 */
function RechargeRouter() {
  const searchParams = useSearchParams()
  const isExternalMode = searchParams.has('merchant_id')

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.add('no-global-header')
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('no-global-header')
      }
    }
  }, [])

  // 外部商户模式：无需登录
  if (isExternalMode) {
    return <ExternalRechargeContent />
  }

  // 内部充值模式：需要登录
  return (
    <AuthGuard>
      <RechargeContent />
    </AuthGuard>
  )
}

export default function RechargePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh md:min-h-screen bg-[#0b1021] flex items-center justify-center">
          <div className="text-[#e2e8f0]">加载中...</div>
        </div>
      }
    >
      <RechargeRouter />
    </Suspense>
  )
}

function RechargeContent() {
  const [methods, setMethods] = useState<PaymentMethodKey[]>([])
  const [packages, setPackages] = useState<RechargePackageOption[]>([])
  const [assetCode, setAssetCode] = useState<string>('SCORE')
  const [currency, setCurrency] = useState<string>('USD')
  const [creating, setCreating] = useState(false)
  const [membershipTipsOpen, setMembershipTipsOpen] = useState(false)
  const [exchangeRate, setExchangeRate] = useState<number>(7.2)
  const isTouchDevice = useIsTouchDevice()

  const { user } = useAuth()

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

  useEffect(() => {
    let mounted = true
    PaymentService.getOptions()
      .then(res => {
        if (!mounted) return
        const m = Array.isArray(res.methods) ? res.methods : []
        const deduped = Array.from(
          new Set(m.filter((x: unknown) => typeof x === 'string')),
        ) as PaymentMethodKey[]
        const codes = Array.isArray(res.targetAssetCodes) ? res.targetAssetCodes : []
        setMethods(deduped)
        if (codes.includes('SCORE')) setAssetCode('SCORE')
        else if (codes.length > 0) setAssetCode(String(codes[0]))

        const sc = res.settlementCurrency
        if (typeof sc === 'string' && sc.length > 0) setCurrency(sc.toUpperCase())

        const packageList = Array.isArray(res.packages) ? res.packages : []
        setPackages(packageList)

        const er = Number(res.exchangeRate)
        if (Number.isFinite(er) && er > 0) setExchangeRate(er)
      })
      .catch(() => {
        setMethods([])
        setAssetCode('SCORE')
        setCurrency('USD')
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
    (orderId: string, popup: Window | null) => {
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
            messageService.info('支付超时，请到订单中心查看')
            return
          }

          if (Date.now() - startTime > maxDurationMs) {
            stopPolling()
            messageService.info('支付超时，请到订单中心查看')
            return
          }

          const order = await PaymentService.getOrderById(orderId)
          consecutiveErrors = 0

          if (order.status === 'COMPLETED') {
            stopPolling()
            messageService.success('充值成功！')
            // 外部来源：如果有 returnUrl，跳转回商户页面
            const returnUrl = (order as { returnUrl?: string }).returnUrl
            if (returnUrl) {
              setTimeout(() => {
                window.location.href = returnUrl
              }, 1500)
            }
          } else if (order.status === 'FAILED') {
            stopPolling()
            messageService.error('支付失败，请重试')
          }
        } catch (err) {
          if (isAxiosError(err) && err.response?.status === 404) {
            stopPolling()
            messageService.info('订单已失效，请前往订单中心查看最新状态')
            return
          }
          consecutiveErrors += 1
          if (consecutiveErrors >= maxConsecutiveErrors) {
            stopPolling()
            messageService.error('订单状态查询多次失败，请稍后在订单中心查看最新状态')
            return
          }
          console.error('查询订单状态失败', err)
        } finally {
          isChecking = false
        }
      }

      pollingTimerRef.current = setInterval(() => {
        void checkOrder()
      }, pollIntervalMs)

      void checkOrder()
    },
    [stopPolling],
  )

  const confirmBuy = useCallback(
    async (method: PaymentMethodKey) => {
      if (!pendingOption) return
      setSelectedIndex(null)
      setCreating(true)
      try {
        const priceValue = Number(pendingOption.priceAmount)
        const fixed = Number.isFinite(priceValue)
          ? priceValue.toFixed(2)
          : Number(pendingOption.priceAmount || 0).toFixed(2)
        const requestAmount = Number(fixed)
        if (!Number.isFinite(requestAmount) || requestAmount <= 0) {
          throw new Error('金额配置错误')
        }
        const requestCurrency = (pendingOption.priceCurrency || currency).toUpperCase()
        const { order, redirectUrl } = await PaymentService.createOrderAndGetRedirectUrl({
          amount: requestAmount.toString(),
          currency: requestCurrency,
          method: method as PaymentMethod,
          targetAssetCode: assetCode,
          packageId: pendingOption.id,
        })
        if (redirectUrl) messageService.success?.('下单成功，正在跳转至支付页面')
        else messageService.success?.('下单成功，正在等待支付链接，请稍后在订单中心查看')

        if (redirectUrl) {
          const orderId = order?.id
          if (!orderId) {
            messageService.error?.('订单创建成功但缺少订单编号，请稍后重试')
            return
          }

          const windowName = `payment_${orderId}`
          const popup = window.open(
            redirectUrl,
            windowName,
            'noopener,noreferrer,width=800,height=600',
          )

          if (!popup || popup.closed) {
            messageService.info('浏览器已拦截支付窗口，将在当前页面打开支付链接')
            setTimeout(() => {
              window.location.href = redirectUrl
            }, 1000)
            return
          }

          startOrderPolling(orderId, popup)
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
    [assetCode, currency, pendingOption, startOrderPolling],
  )

  return (
    <TooltipProvider>
      <main className="min-h-dvh md:min-h-screen bg-[#0b1021]">
        <div className="pt-4 pb-40 md:pb-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-[#e2e8f0]">充值套餐</h1>
              <div className="text-lg flex items-center gap-1">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-lime-500/20 text-lime-400">
                  ¥
                </span>
                <span className="text-[#e2e8f0]">当前用户:</span>
                <span className="text-green-400">{user?.nickname || user?.email || '未登录'}</span>
              </div>
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

                  const isMembershipPackage =
                    opt.badgeLabel?.includes('月卡') || opt.displayTitle?.includes('月卡')

                  return (
                    <div
                      key={opt.id ?? idx}
                      onClick={() => onSelectMobile(opt, idx)}
                      className="relative min-[480px]:aspect-[4/5] md:aspect-[5/6] cursor-pointer"
                    >
                      {/* 会员月卡 tips 图标 */}
                      {isMembershipPackage &&
                        (isTouchDevice ? (
                          <button
                            type="button"
                            aria-label="查看月卡规则说明"
                            className="absolute right-1.5 top-1.5 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#6366f1]/80 text-white shadow-md hover:bg-[#6366f1]"
                            onClick={event => {
                              event.stopPropagation()
                              setMembershipTipsOpen(true)
                            }}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label="查看月卡规则说明"
                                className="absolute right-2 top-2 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6366f1]/80 text-white shadow-md hover:bg-[#6366f1]"
                                onClick={event => {
                                  event.stopPropagation()
                                }}
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm text-left leading-relaxed space-y-2 bg-[#020617]/95 border-[#1e293b] backdrop-blur-sm">
                              <p className="font-bold text-[#e2e8f0] text-sm mb-2">
                                月卡积分领取规则说明
                              </p>
                              <div className="space-y-2 text-xs text-[#94a3b8]">
                                <p>
                                  <span className="font-medium text-[#e2e8f0]">1.</span>{' '}
                                  系统会检查你
                                  <span className="font-semibold text-[#6366f1]">
                                    最近两天领取的月卡积分
                                  </span>
                                  的使用情况。
                                </p>
                                <p>
                                  <span className="font-medium text-[#e2e8f0]">2.</span>{' '}
                                  只有当
                                  <span className="font-semibold text-[#6366f1]">
                                    最近两天领取的积分已消耗至少 80%
                                  </span>
                                  （也就是当前剩余 ≤ 20%）时，才可以继续领取当天的月卡积分。
                                </p>
                                <p>
                                  <span className="font-medium text-[#e2e8f0]">3.</span>{' '}
                                  如果最近两天领取的积分还大部分没有用掉（剩余超过 20%），当天将无法继续领取，需要先多消耗一些再来领取。
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}

                      {/* 顶部标签 */}
                      <div className="pointer-events-none absolute -left-[6px] top-[8px] z-20 flex items-center justify-center rounded-tr-[16px] rounded-br-[16px] bg-gradient-to-r from-[#6366f1] to-[#9333ea] px-3 py-1.5 md:py-2 shadow-[0_2px_6px_rgba(0,0,0,0.3)]">
                        <div className="max-w-[140px] min-[480px]:max-w-[120px] truncate text-[11px] md:text-xs font-bold text-white text-center">
                          {opt.badgeLabel || labelForOption(opt)}
                        </div>
                      </div>

                      <div
                        className={`
                          relative flex h-full w-full flex-col rounded-tr-[20px] border overflow-hidden
                          ${isMembershipPackage ? 'border-amber-400/50' : 'border-[#1e293b]/50'}
                          ${bonusPercent >= 20 ? 'bg-gradient-to-b from-[#1e1b4b]/50 to-[#0f172a]' : 'bg-[#0f172a]'}
                          ${selectedIndex === idx ? 'ring-2 md:ring-[3px] ring-[#6366f1]/80 scale-[1.01] md:scale-[1.02] shadow-md' : 'md:hover:scale-[1.005] md:hover:shadow-md'}
                          shadow-sm cursor-pointer md:cursor-default transition-all duration-200 ease-out active:scale-[0.98] md:active:scale-100
                        `}
                      >
                        {/* 中部主视觉 */}
                        <div className="flex flex-1 flex-col items-center px-3 pb-2 pt-3 md:px-4 md:pt-8 md:pb-2">
                          <div className="flex flex-col items-center w-full flex-shrink-0">
                            {!isMembershipPackage && (
                              <img
                                src="https://prod.ugirl.ai/icons/jifen.png"
                                alt="积分图标"
                                className="w-12 min-[480px]:w-14 md:w-16 h-12 min-[480px]:h-14 md:h-16 object-contain mx-auto mb-1 mt-0 md:mt-2"
                              />
                            )}

                            {isMembershipPackage && (
                              <img
                                src="https://prod.ugirl.ai/icons/yueka.png"
                                alt="月卡图标"
                                className="w-12 min-[480px]:w-14 md:w-16 h-12 min-[480px]:h-14 md:h-16 object-contain mx-auto mb-0.5 mt-0 md:mt-2"
                              />
                            )}

                            {/* 赠送比例高亮文案 */}
                            {!isMembershipPackage &&
                              (bonusPercent >= 10 ? (
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
                              ))}
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
                <li>购买的积分将以平台资产（score）的形式到账，可用于聊天、解锁内容等。</li>
                <li>如果支付受限：刷新页面或者在充值页面拉到底部，复制网址到浏览器新的页面支付</li>
                <li>如遇问题，请及时联系客服。</li>
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

        {/* 会员月卡规则提示弹窗（移动端专用） */}
        <Dialog open={membershipTipsOpen} onOpenChange={setMembershipTipsOpen}>
          <DialogContent onInteractOutside={event => event.preventDefault()}>
            <DialogHeader>
              <DialogTitle>月卡积分领取规则说明</DialogTitle>
              <DialogDescription>
                月卡每日可以领取固定数量的积分，但为了鼓励持续游玩，有以下限制：
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm text-[#94a3b8]">
              <p>
                1. 系统会检查你
                <span className="font-semibold text-[#6366f1]">最近两天领取的月卡积分</span>
                的使用情况。
              </p>
              <p>
                2. 只有当
                <span className="font-semibold text-[#6366f1]">
                  最近两天领取的积分已消耗至少 80%
                </span>
                （也就是当前剩余 ≤ 20%）时，才可以继续领取当天的月卡积分。
              </p>
              <p>
                3. 如果最近两天领取的积分还大部分没有用掉（剩余超过 20%），当天将无法继续领取，需要先多消耗一些再来领取。
              </p>
            </div>
            <DialogFooter />
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
