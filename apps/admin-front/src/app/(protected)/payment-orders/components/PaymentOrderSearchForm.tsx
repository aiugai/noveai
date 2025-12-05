'use client'

import { useEffect } from 'react'
import type { Dayjs } from 'dayjs'
import { Button, Col, DatePicker, Form, Input, Row, Select } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'

import type { AdminPaymentOrderStatus } from '@/lib/api'

export interface PaymentOrderFilterValues {
  userId?: string
  status?: AdminPaymentOrderStatus
  channel?: string
  dateRange?: [Dayjs, Dayjs]
}

interface Props {
  initialValues: PaymentOrderFilterValues
  onSearch: (values: PaymentOrderFilterValues) => void
  onReset: () => void
}

const statusOptions = [
  { label: '待支付', value: 'PENDING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '失败', value: 'FAILED' },
  { label: '已过期', value: 'EXPIRED' },
  { label: '已取消', value: 'CANCELLED' },
] 

export default function PaymentOrderSearchForm({ initialValues, onSearch, onReset }: Props) {
  const [form] = Form.useForm<PaymentOrderFilterValues>()

  useEffect(() => {
    form.setFieldsValue(initialValues)
  }, [form, initialValues])

  const handleSubmit = (values: PaymentOrderFilterValues) => {
    onSearch(values)
  }

  const handleReset = () => {
    form.resetFields()
    onReset()
  }

  return (
    <Form
      form={form}
      onFinish={handleSubmit}
      layout="vertical"
      initialValues={initialValues}
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[16, 8]}>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="userId" label="用户ID">
            <Input placeholder="精确匹配用户ID" allowClear />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="status" label="订单状态">
            <Select
              allowClear
              placeholder="请选择订单状态"
              options={statusOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="channel" label="支付渠道">
            <Input placeholder="如 wgqpay / mock" allowClear />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="dateRange" label="创建时间">
            <DatePicker.RangePicker
              showTime
              allowClear
              style={{ width: '100%' }}
              format="YYYY-MM-DD HH:mm:ss"
              placeholder={['开始时间', '结束时间']}
            />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              搜索
            </Button>
            <Button style={{ marginLeft: 8 }} icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Form.Item>
        </Col>
      </Row>
    </Form>
  )
}

