'use client'

import { useState } from 'react'
import { Button, Descriptions, Empty, message, Modal, Spin, Tag } from 'antd'
import dayjs from 'dayjs'

import type { AdminPaymentOrderDetail, AdminPaymentOrderStatus, CallbackStatus } from '@/lib/api'
import { retryOrderCallback, simulateOrderCallback } from '@/lib/api'

interface Props {
  visible: boolean
  loading: boolean
  order: AdminPaymentOrderDetail | null
  onClose: () => void
  onRefresh?: () => void
}

const isProduction = process.env.NEXT_PUBLIC_APP_ENV === 'production'

const statusColorMap: Record<AdminPaymentOrderStatus, string> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  FAILED: 'error',
  EXPIRED: 'default',
  CANCELLED: 'default',
}

const statusTextMap: Record<AdminPaymentOrderStatus, string> = {
  PENDING: '待支付',
  COMPLETED: '已完成',
  FAILED: '失败',
  EXPIRED: '已过期',
  CANCELLED: '已取消',
}

const callbackStatusColorMap: Record<CallbackStatus, string> = {
  PENDING: 'processing',
  SUCCESS: 'success',
  FAILED: 'error',
}

const callbackStatusTextMap: Record<CallbackStatus, string> = {
  PENDING: '通知中',
  SUCCESS: '已通知',
  FAILED: '通知失败',
}

export default function OrderDetailModal({ visible, loading, order, onClose, onRefresh }: Props) {
  const [simulating, setSimulating] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const handleSimulateCallback = async () => {
    if (!order) return
    setSimulating(true)
    try {
      await simulateOrderCallback(order.id)
      message.success('模拟支付成功')
      onRefresh?.()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '模拟支付失败')
    } finally {
      setSimulating(false)
    }
  }

  const handleRetryCallback = async () => {
    if (!order) return
    setRetrying(true)
    try {
      await retryOrderCallback(order.id)
      message.success('回调重试已发起')
      onRefresh?.()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '回调重试失败')
    } finally {
      setRetrying(false)
    }
  }

  const canSimulate = !isProduction && order?.status === 'PENDING'

  // 外部订单、已完成、回调失败或待通知时可重试
  const canRetryCallback =
    order?.sourceType === 'EXTERNAL' &&
    order?.status === 'COMPLETED' &&
    order?.callbackStatus !== 'SUCCESS'

  return (
    <Modal title="订单详情" open={visible} onCancel={onClose} footer={null} width={820}>
      <Spin spinning={loading}>
        {order ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="订单ID" span={2}>
              {order.id}
            </Descriptions.Item>
            <Descriptions.Item label="用户ID" span={2}>
              {order.userId}
            </Descriptions.Item>
            {order.sourceType === 'EXTERNAL' && (
              <>
                <Descriptions.Item label="订单来源" span={2}>
                  <Tag color="blue">外部订单</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="商户ID" span={2}>
                  {order.merchantId || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="外部用户ID" span={2}>
                  {order.externalUserId || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="业务订单号" span={2}>
                  {order.businessOrderId || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="订单描述" span={2}>
                  {order.description || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="回调通知状态" span={1}>
                  {order.callbackStatus ? (
                    <>
                      <Tag color={callbackStatusColorMap[order.callbackStatus] ?? 'default'}>
                        {callbackStatusTextMap[order.callbackStatus] ?? order.callbackStatus}
                      </Tag>
                      {canRetryCallback && (
                        <Button
                          type="link"
                          size="small"
                          loading={retrying}
                          onClick={handleRetryCallback}
                          style={{ marginLeft: 8 }}
                        >
                          立即重试
                        </Button>
                      )}
                    </>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="回调重试次数" span={1}>
                  {order.callbackAttempts ?? '-'}
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="订单金额">
              {order.amount} {order.currency}
            </Descriptions.Item>
            <Descriptions.Item label="订单状态">
              <Tag color={statusColorMap[order.status] || 'default'}>
                {statusTextMap[order.status] ?? order.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="支付渠道">{order.channel}</Descriptions.Item>
            <Descriptions.Item label="第三方订单号">
              {order.externalOrderId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="目标资产类型">
              {order.targetAssetTypeId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="目标资产数量">
              {order.targetAssetAmount || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="汇率">{order.exchangeRate || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(order.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(order.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间">
              {order.completedAt ? dayjs(order.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="过期时间">
              {order.expiresAt ? dayjs(order.expiresAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="支付详情" span={2}>
              {order.paymentDetails ? (
                <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.4, margin: 0 }}>
                  {JSON.stringify(order.paymentDetails, null, 2)}
                </pre>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="回调数据" span={2}>
              {order.callbackData ? (
                <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.4, margin: 0 }}>
                  {JSON.stringify(order.callbackData, null, 2)}
                </pre>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            {canSimulate && (
              <Descriptions.Item label="调试操作" span={2}>
                <Button
                  type="primary"
                  danger
                  loading={simulating}
                  onClick={handleSimulateCallback}
                >
                  模拟支付成功
                </Button>
                <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
                  (仅非生产环境可用，将触发完整的支付回调流程)
                </span>
              </Descriptions.Item>
            )}
          </Descriptions>
        ) : (
          <Empty description="请选择需要查看的订单" />
        )}
      </Spin>
    </Modal>
  )
}

