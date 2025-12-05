'use client'

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'

import {
  AdminSetting,
  AdminSettingType,
  createAdminSetting,
  fetchAdminSettings,
  reloadAdminSettings,
  updateAdminSetting,
} from '@/lib/api'
import RechargePackagesTab from './components/RechargePackagesTab'
import PaymentSettingsTab from './components/PaymentSettingsTab'

const { Text } = Typography
const { TextArea } = Input

interface SettingFormValues {
  key: string
  value: string | number | boolean
  type: AdminSettingType
  description?: string
  category?: string
  isSystem: boolean
}

const SETTING_TYPE_OPTIONS: { label: string; value: AdminSettingType }[] = [
  { label: '字符串', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: 'JSON', value: 'json' },
]

export default function AdminSettingsPage() {
  const { message } = App.useApp()
  const [settings, setSettings] = useState<AdminSetting[]>([])
  const [loading, setLoading] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingSetting, setEditingSetting] = useState<AdminSetting | null>(null)
  const [categoryInput, setCategoryInput] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined)
  const [form] = Form.useForm<SettingFormValues>()

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminSettings(categoryFilter)
      setSettings(data)
    } catch (error: any) {
      message.error(error?.message ?? '获取配置失败')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, message])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleCategorySearch = (value: string) => {
    setCategoryFilter(value.trim() ? value.trim() : undefined)
  }

  const handleCategoryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setCategoryInput(value)
    if (!value.trim()) {
      setCategoryFilter(undefined)
    }
  }

  const openCreateModal = () => {
    setEditingSetting(null)
    form.resetFields()
    form.setFieldsValue({
      type: 'string',
      isSystem: false,
    })
    setModalVisible(true)
  }

  const openEditModal = (record: AdminSetting) => {
    setEditingSetting(record)
    form.setFieldsValue({
      key: record.key,
      value: toFormValue(record.value, record.type),
      type: record.type,
      description: record.description ?? undefined,
      category: record.category ?? undefined,
      isSystem: record.isSystem,
    })
    setModalVisible(true)
  }

  const handleReloadSettings = async () => {
    setReloading(true)
    try {
      await reloadAdminSettings()
      message.success('配置已重新加载')
      await loadSettings()
    } catch (error: any) {
      message.error(error?.message ?? '重新加载失败')
    } finally {
      setReloading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const parsedValue = parseSettingValue(values.value, values.type)
      if (editingSetting) {
        await updateAdminSetting(editingSetting.key, {
          value: parsedValue,
          type: values.type,
          description: values.description?.trim() || undefined,
          category: values.category?.trim() || undefined,
          isSystem: values.isSystem,
        })
        message.success('配置已更新')
      } else {
        await createAdminSetting({
          key: values.key.trim(),
          value: parsedValue,
          type: values.type,
          description: values.description?.trim() || undefined,
          category: values.category?.trim() || undefined,
          isSystem: values.isSystem,
        })
        message.success('配置已创建')
      }
      setModalVisible(false)
      await loadSettings()
    } catch (error: any) {
      if (error?.message) {
        message.error(error.message)
      }
    }
  }

  const columns: ColumnsType<AdminSetting> = useMemo(
    () => [
      { title: '键名', dataIndex: 'key', width: 200 },
      {
        title: '配置值',
        render: (_, record) => (
          <Text code ellipsis={{ tooltip: true }} style={{ maxWidth: 320 }}>
            {formatSettingValue(record.value)}
          </Text>
        ),
      },
      {
        title: '类型',
        dataIndex: 'type',
        width: 100,
        render: type => <Tag>{type}</Tag>,
      },
      {
        title: '分类',
        dataIndex: 'category',
        width: 120,
        render: value => value || '—',
      },
      {
        title: '描述',
        dataIndex: 'description',
        render: value => value || '—',
      },
      {
        title: '系统配置',
        dataIndex: 'isSystem',
        width: 120,
        render: value => <Tag color={value ? 'red' : 'green'}>{value ? '是' : '否'}</Tag>,
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        width: 180,
        render: value => formatDatetime(value),
      },
      {
        title: '操作',
        width: 120,
        render: (_, record) => (
          <Button type="link" onClick={() => openEditModal(record)}>
            编辑
          </Button>
        ),
      },
    ],
    [],
  )

  const settingsContent = (
    <Card className="dashboard-card">
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <Space.Compact>
            <Input
              allowClear
              placeholder="按分类筛选，如 site"
              value={categoryInput}
              onChange={handleCategoryChange}
              onPressEnter={() => handleCategorySearch(categoryInput)}
              style={{ width: 200 }}
            />
            <Button
              icon={<SearchOutlined />}
              onClick={() => handleCategorySearch(categoryInput)}
            />
          </Space.Compact>
          <Button type="primary" onClick={openCreateModal}>
            新建配置
          </Button>
          <Button onClick={handleReloadSettings} loading={reloading}>
            重新加载配置
          </Button>
        </Space>
      </div>

      <Table<AdminSetting>
        rowKey="id"
        columns={columns}
        dataSource={settings}
        loading={loading}
        pagination={false}
      />
    </Card>
  )

  return (
    <div className="page-container">
      <Card title="系统配置管理" className="dashboard-card">
        <Tabs
          defaultActiveKey="payment"
          items={[
            {
              key: 'payment',
              label: '支付参数',
              children: (
                <PaymentSettingsTab onReload={handleReloadSettings} loading={reloading} />
              ),
            },
            {
              key: 'recharge-packages',
              label: '充值套餐',
              children: <RechargePackagesTab />,
            },
            {
              key: 'all-settings',
              label: '全部配置',
              children: settingsContent,
            },
          ]}
        />
      </Card>

      <Modal
        destroyOnHidden
        forceRender
        title={editingSetting ? '编辑配置' : '新建配置'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okText={editingSetting ? '保存' : '创建'}
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="键名"
            name="key"
            rules={[{ required: true, message: '请输入配置键名' }]}
          >
            <Input placeholder="site.title" disabled={!!editingSetting} />
          </Form.Item>

          <Form.Item
            label="配置值"
            dependencies={['type']}
          >
            {() => {
              const currentType = form.getFieldValue('type') as AdminSettingType | undefined
              const isBoolean = currentType === 'boolean'
              const isNumber = currentType === 'number'
              const isJson = currentType === 'json'

              return (
                <Form.Item
                  name="value"
                  noStyle
                  valuePropName={isBoolean ? 'checked' : 'value'}
                  rules={[{ required: true, message: '请输入配置值' }]}
                >
                  {isBoolean ? (
                    <Switch checkedChildren="true" unCheckedChildren="false" />
                  ) : isNumber ? (
                    <InputNumber style={{ width: '100%' }} placeholder="请输入数字" />
                  ) : (
                    <TextArea
                      rows={4}
                      placeholder={
                        isJson ? '请输入合法 JSON，如 {"siteTitle": "Demo"}' : '请输入配置值'
                      }
                    />
                  )}
                </Form.Item>
              )
            }}
          </Form.Item>

          <Form.Item
            label="值类型"
            name="type"
            rules={[{ required: true, message: '请选择值类型' }]}
          >
            <Select options={SETTING_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item label="分类" name="category">
            <Input placeholder="site / payment / ai" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="该配置的用途说明" />
          </Form.Item>

          <Form.Item label="系统配置" name="isSystem" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function toFormValue(
  value: AdminSetting['value'],
  type: AdminSettingType,
): SettingFormValues['value'] {
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      if (lower === 'true') return true
      if (lower === 'false') return false
    }
    return false
  }

  if (type === 'number') {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const num = Number(value)
      if (!Number.isNaN(num)) return num
    }
    return 0
  }

  // string / json 默认展示为字符串
  return formatSettingValue(value)
}

function formatSettingValue(value: AdminSetting['value']) {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return '[object]'
    }
  }
  return String(value)
}

function formatDatetime(value?: string | Date) {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function parseSettingValue(value: SettingFormValues['value'], type: AdminSettingType) {
  switch (type) {
    case 'number': {
      const num = typeof value === 'number' ? value : Number(String(value).trim())
      if (Number.isNaN(num)) {
        throw new TypeError('请输入合法的数字')
      }
      return num
    }
    case 'boolean': {
      if (typeof value === 'boolean') {
        return value
      }
      const trimmed = String(value).trim().toLowerCase()
      if (trimmed === 'true') return true
      if (trimmed === 'false') return false
      throw new TypeError('布尔类型的值只能为 true 或 false')
    }
    case 'json': {
      const trimmed = String(value).trim()
      try {
        return trimmed ? JSON.parse(trimmed) : null
      } catch {
        throw new TypeError('JSON 格式不正确')
      }
    }
    default:
      return String(value)
  }
}
