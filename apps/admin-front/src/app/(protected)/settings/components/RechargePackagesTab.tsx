'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'

import {
  createRechargePackage,
  fetchRechargePackages,
  RechargePackage,
  RechargePackageStatus,
  toggleRechargePackageStatus,
  updateRechargePackage,
} from '@/lib/api'

interface FormValues {
  name: string
  displayTitle: string
  badgeLabel: string
  priceAmount: number
  priceCurrency: string
  baseScore: number
  bonusPercent: number
  totalScore: number
  sortOrder: number
  status: RechargePackageStatus
}

const STATUS_OPTIONS = [
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'INACTIVE' },
]

export default function RechargePackagesTab() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [packages, setPackages] = useState<RechargePackage[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<FormValues>()

  const fetchPackages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchRechargePackages({ page: 1, limit: 100 })
      setPackages(res.items ?? [])
    } catch (error: any) {
      message.error(error?.message ?? '加载充值套餐失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void fetchPackages()
  }, [fetchPackages])

  const handleCreate = () => {
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue({
      priceCurrency: 'USD',
      status: 'ACTIVE',
      sortOrder: 0,
      bonusPercent: 0,
    })
    setDrawerOpen(true)
  }

  const handleEdit = (record: RechargePackage) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      displayTitle: record.displayTitle,
      badgeLabel: record.badgeLabel,
      priceAmount: Number(record.priceAmount),
      priceCurrency: record.priceCurrency,
      baseScore: record.baseScore,
      bonusPercent: record.bonusPercent,
      totalScore: record.totalScore,
      sortOrder: record.sortOrder,
      status: record.status,
    })
    setDrawerOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const payload = {
        name: values.name,
        displayTitle: values.displayTitle,
        badgeLabel: values.badgeLabel,
        priceAmount: String(values.priceAmount.toFixed(2)),
        priceCurrency: (values.priceCurrency || 'USD').toUpperCase(),
        baseScore: values.baseScore,
        bonusPercent: values.bonusPercent,
        totalScore: values.totalScore,
        sortOrder: values.sortOrder ?? 0,
      }

      if (editingId) {
        await updateRechargePackage(editingId, {
          ...payload,
          status: values.status,
        })
        message.success('更新成功')
      } else {
        await createRechargePackage(payload)
        message.success('创建成功')
      }
      setDrawerOpen(false)
      void fetchPackages()
    } catch (error: any) {
      if (error?.message) {
        message.error(error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (record: RechargePackage) => {
    try {
      await toggleRechargePackageStatus(record.id, record.status)
      message.success('状态已更新')
      void fetchPackages()
    } catch (error: any) {
      message.error(error?.message ?? '操作失败')
    }
  }

  const handleSetInactive = async (record: RechargePackage) => {
    try {
      await updateRechargePackage(record.id, { status: 'INACTIVE' })
      message.success('已停用套餐')
      void fetchPackages()
    } catch (error: any) {
      message.error(error?.message ?? '操作失败')
    }
  }

  const handleValuesChange = (
    _changedValues: Partial<FormValues>,
    values: Partial<FormValues>,
  ) => {
    const { baseScore, bonusPercent } = values
    if (typeof baseScore === 'number' && typeof bonusPercent === 'number') {
      const bonus = Math.round((baseScore * bonusPercent) / 100)
      form.setFieldsValue({ totalScore: baseScore + bonus })
    }
  }

  const columns: ColumnsType<RechargePackage> = useMemo(
    () => [
      { title: '内部名称', dataIndex: 'name', width: 140 },
      { title: '展示标题', dataIndex: 'displayTitle', width: 160 },
      { title: '徽标', dataIndex: 'badgeLabel', width: 120 },
      {
        title: '价格',
        dataIndex: 'priceAmount',
        width: 100,
        render: (_: string, record: RechargePackage) =>
          `${record.priceCurrency} ${record.priceAmount}`,
      },
      { title: '基础积分', dataIndex: 'baseScore', width: 120 },
      {
        title: '赠送%',
        dataIndex: 'bonusPercent',
        width: 100,
        render: (value: number) => `${value}%`,
      },
      { title: '总积分', dataIndex: 'totalScore', width: 120 },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (value: RechargePackageStatus) => (
          <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>
            {value === 'ACTIVE' ? '启用' : '停用'}
          </Tag>
        ),
      },
      { title: '排序', dataIndex: 'sortOrder', width: 100 },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 220,
        render: (_: unknown, record: RechargePackage) => (
          <Space size={8}>
            <Button size="small" onClick={() => handleEdit(record)}>
              编辑
            </Button>
            <Button size="small" onClick={() => handleToggleStatus(record)}>
              {record.status === 'ACTIVE' ? '停用' : '启用'}
            </Button>
            <Popconfirm
              title="确认停用该套餐?"
              onConfirm={() => handleSetInactive(record)}
              okText="确认"
              cancelText="取消"
            >
              <Button size="small" danger>
                停用并隐藏
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [],
  )

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建套餐
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetchPackages()}
          loading={loading}
        >
          刷新
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={packages}
        columns={columns}
        scroll={{ x: 900 }}
        pagination={false}
      />

      <Drawer
        open={drawerOpen}
        width={520}
        title={editingId ? '编辑套餐' : '新建套餐'}
        destroyOnClose
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSubmit} loading={submitting}>
              保存
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            priceCurrency: 'USD',
            status: 'ACTIVE',
            sortOrder: 0,
          }}
          onValuesChange={handleValuesChange}
        >
          <Form.Item
            name="name"
            label="内部名称"
            rules={[{ required: true, message: '请输入内部名称' }]}
          >
            <Input placeholder="starter" disabled={Boolean(editingId)} />
          </Form.Item>
          <Form.Item
            name="displayTitle"
            label="展示标题"
            rules={[{ required: true, message: '请输入展示标题' }]}
          >
            <Input placeholder="例如：750 积分" />
          </Form.Item>
          <Form.Item
            name="badgeLabel"
            label="徽标文案"
            rules={[{ required: true, message: '请输入徽标文案' }]}
          >
            <Input placeholder="例如：萌新套餐" />
          </Form.Item>
          <Form.Item
            name="priceAmount"
            label="价格金额"
            rules={[{ required: true, message: '请输入价格金额' }]}
          >
            <InputNumber
              min={0.01}
              step={0.01}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="priceCurrency" label="价格币种">
            <Input placeholder="USD" />
          </Form.Item>
          <Form.Item
            name="baseScore"
            label="基础积分"
            rules={[{ required: true, message: '请输入基础积分' }]}
          >
            <InputNumber min={0} step={50} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="bonusPercent"
            label="赠送百分比"
            rules={[{ required: true, message: '请输入赠送百分比' }]}
          >
            <InputNumber min={0} max={100} step={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="totalScore"
            label="总积分"
            rules={[{ required: true, message: '请输入总积分' }]}
          >
            <InputNumber min={0} step={50} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
