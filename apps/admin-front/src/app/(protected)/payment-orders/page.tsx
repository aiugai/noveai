'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TablePaginationConfig, ColumnsType, TableProps } from 'antd/es/table'
import { App, Button, Card, Table, Tabs, Tag } from 'antd'
import dayjs from 'dayjs'

import type {
  AdminPaymentOrder,
  AdminPaymentOrderDetail,
  AdminPaymentOrderStatus,
  CallbackStatus,
  PaymentOrderSourceType,
} from '@/lib/api'
import {
  fetchAdminPaymentOrderDetail,
  fetchAdminPaymentOrders,
} from '@/lib/api'
import PaymentOrderSearchForm, {
  PaymentOrderFilterValues,
} from './components/PaymentOrderSearchForm'
import OrderDetailModal from './components/OrderDetailModal'

const DEFAULT_PAGE_SIZE = 20

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

export default function PaymentOrdersPage() {
  const { message } = App.useApp()
  const [orders, setOrders] = useState<AdminPaymentOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<PaymentOrderFilterValues>({})
  const [pageState, setPageState] = useState({ page: 1, limit: DEFAULT_PAGE_SIZE, total: 0 })
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<AdminPaymentOrderDetail | null>(null)
  const [activeTab, setActiveTab] = useState<PaymentOrderSourceType>('INTERNAL')
  const latestRequestIdRef = useRef(0)
  const initializedRef = useRef(false)

  const loadOrders = useCallback(
    async (args: {
      filters: PaymentOrderFilterValues
      page: number
      limit: number
      sourceType: PaymentOrderSourceType
    }) => {
      const requestId = ++latestRequestIdRef.current
      setLoading(true)
      try {
        const response = await fetchAdminPaymentOrders({
          page: args.page,
          limit: args.limit,
          userId: args.filters.userId?.trim() || undefined,
          status: args.filters.status || undefined,
          channel: args.filters.channel?.trim() || undefined,
          startTime: args.filters.dateRange?.[0]?.toISOString(),
          endTime: args.filters.dateRange?.[1]?.toISOString(),
          sourceType: args.sourceType,
        })

        // 丢弃陈旧响应：若请求 ID 与当前最新请求不匹配，忽略该响应
        if (latestRequestIdRef.current !== requestId) {
          return
        }

        setOrders(response.items)
        setPageState({ page: response.page, limit: response.limit, total: response.total })
        setFilters(args.filters)
      } catch (error) {
        // 同样检查是否为陈旧请求
        if (latestRequestIdRef.current !== requestId) {
          return
        }
        const errMsg = error instanceof Error ? error.message : '获取充值订单失败'
        message.error(errMsg)
      } finally {
        // 仅当是最新请求时才取消 loading 状态
        if (latestRequestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    },
    [message],
  )

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    void loadOrders({ filters: {}, page: 1, limit: DEFAULT_PAGE_SIZE, sourceType: activeTab })
  }, [loadOrders, activeTab])

  const paginationConfig: TablePaginationConfig = useMemo(
    () => ({
      current: pageState.page,
      pageSize: pageState.limit,
      total: pageState.total,
      showSizeChanger: true,
      showTotal: total => `总计 ${total} 条记录`,
    }),
    [pageState],
  )

  const handleSearch = (values: PaymentOrderFilterValues) => {
    void loadOrders({
      filters: values,
      page: 1,
      limit: pageState.limit,
      sourceType: activeTab,
    })
  }

  const handleResetFilters = () => {
    void loadOrders({
      filters: {},
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
      sourceType: activeTab,
    })
  }

  const handleTableChange: TableProps<AdminPaymentOrder>['onChange'] = pagination => {
    const nextPage = pagination?.current ?? 1
    const nextLimit = pagination?.pageSize ?? pageState.limit
    void loadOrders({
      filters,
      page: nextPage,
      limit: nextLimit,
      sourceType: activeTab,
    })
  }

  const handleTabChange = (key: string) => {
    const newTab = key as PaymentOrderSourceType
    setActiveTab(newTab)
    void loadOrders({
      filters,
      page: 1,
      limit: pageState.limit,
      sourceType: newTab,
    })
  }

  const openOrderDetail = useCallback(
    async (orderId: string) => {
      setDetailVisible(true)
      setDetailLoading(true)
      try {
        const detail = await fetchAdminPaymentOrderDetail(orderId)
        setSelectedOrder(detail)
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : '获取订单详情失败'
        message.error(errMsg)
        setDetailVisible(false)
      } finally {
        setDetailLoading(false)
      }
    },
    [message],
  )

  const columns: ColumnsType<AdminPaymentOrder> = useMemo(() => {
    const baseColumns: ColumnsType<AdminPaymentOrder> = [
      {
        title: '订单ID',
        dataIndex: 'id',
        width: 200,
      },
      {
        title: '用户ID',
        dataIndex: 'userId',
        width: 180,
      },
      {
        title: '订单状态',
        dataIndex: 'status',
        width: 120,
        render: (status: AdminPaymentOrderStatus) => (
          <Tag color={statusColorMap[status] || 'default'}>{statusTextMap[status] ?? status}</Tag>
        ),
      },
      {
        title: '支付渠道',
        dataIndex: 'channel',
        width: 140,
        render: (channel: string | null) => channel || '-',
      },
      {
        title: '订单金额',
        dataIndex: 'amount',
        align: 'right',
        width: 140,
        render: (amount: string, record) => `${amount} ${record.currency}`,
      },
      {
        title: '第三方订单号',
        dataIndex: 'externalOrderId',
        width: 220,
        render: (value: string | null) => value || '-',
      },
    ]

    const merchantColumns: ColumnsType<AdminPaymentOrder> = [
      {
        title: '商户ID',
        dataIndex: 'merchantId',
        width: 200,
        render: (value: string | null) => value || '-',
      },
      {
        title: '外部用户ID',
        dataIndex: 'externalUserId',
        width: 180,
        render: (value: string | null) => value || '-',
      },
      {
        title: '业务订单号',
        dataIndex: 'businessOrderId',
        width: 220,
        render: (value: string | null) => value || '-',
      },
      {
        title: '回调状态',
        dataIndex: 'callbackStatus',
        width: 140,
        render: (status: CallbackStatus | null, record) => {
          if (!status) return '-'
          const text = callbackStatusTextMap[status] ?? status
          const color = callbackStatusColorMap[status] ?? 'default'
          const attempts = record.callbackAttempts
          return (
            <Tag color={color}>
              {text}
              {status === 'FAILED' && attempts ? ` (${attempts}次)` : ''}
            </Tag>
          )
        },
      },
    ]

    const timeColumns: ColumnsType<AdminPaymentOrder> = [
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 180,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        width: 180,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
      },
    ]

    const actionColumns: ColumnsType<AdminPaymentOrder> = [
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 120,
        render: (_, record) => (
          <Button type="link" onClick={() => openOrderDetail(record.id)}>
            查看详情
          </Button>
        ),
      },
    ]

    return activeTab === 'EXTERNAL'
      ? [...baseColumns, ...merchantColumns, ...timeColumns, ...actionColumns]
      : [...baseColumns, ...timeColumns, ...actionColumns]
  }, [activeTab, openOrderDetail])

  return (
    <div className="page-container">
      <Card title="充值订单管理" variant="borderless">
        <PaymentOrderSearchForm
          initialValues={filters}
          onSearch={handleSearch}
          onReset={handleResetFilters}
        />
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'INTERNAL',
              label: '本系统订单',
              children: (
                <Table<AdminPaymentOrder>
                  rowKey="id"
                  columns={columns}
                  dataSource={orders}
                  loading={loading}
                  pagination={paginationConfig}
                  onChange={handleTableChange}
                  scroll={{ x: 1300 }}
                />
              ),
            },
            {
              key: 'EXTERNAL',
              label: '外部订单',
              children: (
                <Table<AdminPaymentOrder>
                  rowKey="id"
                  columns={columns}
                  dataSource={orders}
                  loading={loading}
                  pagination={paginationConfig}
                  onChange={handleTableChange}
                  scroll={{ x: 1600 }}
                />
              ),
            },
          ]}
        />
      </Card>

      <OrderDetailModal
        visible={detailVisible}
        loading={detailLoading}
        order={selectedOrder}
        onClose={() => {
          setDetailVisible(false)
          setSelectedOrder(null)
        }}
        onRefresh={() => {
          // 刷新订单详情和列表
          if (selectedOrder) {
            void openOrderDetail(selectedOrder.id)
          }
          void loadOrders({ filters, page: pageState.page, limit: pageState.limit, sourceType: activeTab })
        }}
      />
    </div>
  )
}

