'use client'

import { useEffect, useState } from 'react'
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tooltip,
} from 'antd'
import { InfoCircleOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'

import { fetchAdminSettings, updateAdminSetting } from '@/lib/api'

interface PaymentSettingsTabProps {
  onReload?: () => Promise<void> | void
  loading?: boolean
}

interface WebhookSecretRow {
  channel?: string
  secret?: string
}

const CHANNEL_OPTIONS = [
  { label: 'WGQPAY（正式渠道）', value: 'WGQPAY' },
  { label: 'MOCK（测试用）', value: 'MOCK' },
]

const METHOD_OPTIONS = [
  { label: '微信支付', value: 'WECHAT' },
  { label: '支付宝', value: 'ALIPAY' },
  { label: '信用卡', value: 'CREDIT_CARD' },
]

export default function PaymentSettingsTab({ onReload, loading: externalLoading }: PaymentSettingsTabProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentWgq, setCurrentWgq] = useState<Record<string, any>>({})
  const [originalWebhookSecrets, setOriginalWebhookSecrets] = useState<Record<string, unknown>>({})

  const parseJson = (value: unknown): any => {
    if (!value) return undefined
    if (typeof value === 'object') return value
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return undefined
      }
    }
    return undefined
  }

  const normalizeChannels = (raw: unknown): string[] => {
    const parsed = parseJson(raw)
    let list: unknown = parsed ?? raw

    if (Array.isArray(list)) {
      list = list.map(v => String(v).toUpperCase())
    } else if (typeof list === 'string') {
      list = [list.toUpperCase()]
    } else {
      list = []
    }

    const allowed = CHANNEL_OPTIONS.map(opt => opt.value)
    const normalized = (list as string[]).filter(v => allowed.includes(v))
    return normalized.length ? normalized : ['WGQPAY']
  }

  const normalizeMethods = (raw: unknown): string[] => {
    const parsed = parseJson(raw)
    let list: unknown = parsed ?? raw

    if (Array.isArray(list)) {
      list = list.map(v => String(v).toUpperCase())
    } else if (typeof list === 'string') {
      list = [list.toUpperCase()]
    } else {
      list = []
    }

    const allowed = METHOD_OPTIONS.map(opt => opt.value)
    const normalized = (list as string[]).filter(v => allowed.includes(v))
    return normalized.length ? normalized : ['WECHAT', 'ALIPAY', 'CREDIT_CARD']
  }

  const load = async () => {
    setLoading(true)
    try {
      const list = await fetchAdminSettings('payment')
      const map: Record<string, any> = {}
      list.forEach(item => {
        map[item.key] = item
      })

      const channels = normalizeChannels(map['payment.channels.active']?.value)
      const methods = normalizeMethods(map['payment.methods.active']?.value)
      const wgq = (parseJson(map['payment.wgqpay']?.value) || {}) as Record<string, any>
      const webhookSecrets =
        (parseJson(map['payment.webhookSecrets']?.value) || {}) as Record<string, unknown>

      setCurrentWgq(wgq)
      setOriginalWebhookSecrets(webhookSecrets)
      setCurrentWgq(wgq)
      form.setFieldsValue({
        activeChannel: channels[0] || 'WGQPAY',
        activeMethods: methods,
        wgqpay: {
          host: wgq.host || '',
          merchantNo: wgq.merchantNo || '',
          secret: wgq.secret || '',
          payType: wgq.payType || '',
          notifyUrl: wgq.notifyUrl || '',
          returnUrl: wgq.returnUrl || '',
          requestTimeoutMs: wgq.requestTimeoutMs ?? 10000,
          userAgent: wgq.userAgent || 'Admin-Panel/1.0',
          requestMaxRetries: wgq.requestMaxRetries ?? 2,
          requestRetryBaseMs: wgq.requestRetryBaseMs ?? 500,
          callerIp: wgq.callerIp || '127.0.0.1',
          tradeName: wgq.tradeName || 'Recharge',
          callbackMaxSkewSec: wgq.callbackMaxSkewSec ?? 300,
          callbackNonceTtlSec: wgq.callbackNonceTtlSec ?? 300,
          requestContentType: wgq.requestContentType || 'application/json',
        },
        webhookSecrets: Object.entries(webhookSecrets)
          .filter(([, secret]) => secret !== null && secret !== undefined && secret !== '')
          .map(([channel, secret]) => ({
            channel,
            secret,
          })),
      })
    } catch (error: any) {
      message.error(error?.message ?? '加载支付配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const validateUrl = (url: string): boolean => {
    try {
      // eslint-disable-next-line no-new
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const validateWgq = (wgq: Record<string, any>): string | null => {
    const required = [
      'host',
      'merchantNo',
      'secret',
      'payType',
      'notifyUrl',
      'returnUrl',
      'requestTimeoutMs',
      'userAgent',
      'requestMaxRetries',
      'requestRetryBaseMs',
      'callerIp',
      'tradeName',
      'callbackMaxSkewSec',
      'callbackNonceTtlSec',
      'requestContentType',
    ]
    const missing = required.filter(key => wgq[key] === undefined || wgq[key] === null || wgq[key] === '')
    if (missing.length) return `缺少必填字段: ${missing.join(', ')}`

    if (!validateUrl(wgq.notifyUrl) || !validateUrl(wgq.returnUrl)) {
      return 'notifyUrl/returnUrl 必须为合法 URL'
    }

    const allowed = ['application/json', 'application/x-www-form-urlencoded']
    if (!allowed.includes(wgq.requestContentType)) return 'requestContentType 非法'

    const intGt0 = (n: any) => Number.isInteger(Number(n)) && Number(n) > 0
    const intGte0 = (n: any) => Number.isInteger(Number(n)) && Number(n) >= 0
    const within = (n: any, max: number) => Number(n) <= max

    if (!intGt0(wgq.requestTimeoutMs) || !within(wgq.requestTimeoutMs, 60000))
      return 'requestTimeoutMs 必须为正整数且不超过 60000'
    if (!intGte0(wgq.requestRetryBaseMs) || !within(wgq.requestRetryBaseMs, 10000))
      return 'requestRetryBaseMs 必须为非负整数且不超过 10000'
    if (!intGte0(wgq.requestMaxRetries) || !within(wgq.requestMaxRetries, 10))
      return 'requestMaxRetries 必须为非负整数且不超过 10'
    if (!intGt0(wgq.callbackMaxSkewSec) || !within(wgq.callbackMaxSkewSec, 3600))
      return 'callbackMaxSkewSec 必须为正整数且不超过 3600'
    if (!intGt0(wgq.callbackNonceTtlSec) || !within(wgq.callbackNonceTtlSec, 3600))
      return 'callbackNonceTtlSec 必须为正整数且不超过 3600'

    return null
  }

  const saveAll = async () => {
    try {
      setSaving(true)
      const values = await form.validateFields()
      const { activeChannel, activeMethods, wgqpay, webhookSecrets } = values
      const cfg = { ...wgqpay }

      const toNumber = (v: unknown): number => Number(v)
      cfg.requestTimeoutMs = toNumber(cfg.requestTimeoutMs)
      cfg.requestMaxRetries = toNumber(cfg.requestMaxRetries)
      cfg.requestRetryBaseMs = toNumber(cfg.requestRetryBaseMs)
      cfg.callbackMaxSkewSec = toNumber(cfg.callbackMaxSkewSec)
      cfg.callbackNonceTtlSec = toNumber(cfg.callbackNonceTtlSec)
      if (!cfg.callerIp || String(cfg.callerIp).trim() === '')
        cfg.callerIp = currentWgq.callerIp ?? '127.0.0.1'
      if (!cfg.tradeName || String(cfg.tradeName).trim() === '')
        cfg.tradeName = currentWgq.tradeName ?? 'Recharge'

      const validationError = validateWgq(cfg)
      if (validationError) throw new Error(validationError)

      // 1) 先保存 WGQPay 网关配置（网关必须先配置完整，再切换通道）
      await updateAdminSetting('payment.wgqpay', {
        type: 'json',
        value: cfg,
        category: 'payment',
        description: 'WGQPay 网关配置',
        isSystem: true,
      })

      const webhookMap: Record<string, string | null> = {}
      if (Array.isArray(webhookSecrets)) {
        for (const row of webhookSecrets as WebhookSecretRow[]) {
          if (!row) continue
          const channel = String(row.channel || '').trim().toUpperCase()
          const secret = row.secret?.trim()
          if (!channel) continue
          if (!secret) continue
          webhookMap[channel] = secret
        }
      }

      // 对于原本存在但当前未出现在表单中的通道，显式写入 null，表示删除
      const existingChannels = Object.keys(originalWebhookSecrets || {})
      const newChannels = new Set(Object.keys(webhookMap))
      for (const ch of existingChannels) {
        const upper = ch.toUpperCase()
        if (!newChannels.has(upper)) {
          webhookMap[upper] = null
        }
      }

      // 2) 保存 Webhook 密钥映射
      await updateAdminSetting('payment.webhookSecrets', {
        type: 'json',
        value: webhookMap,
        category: 'payment',
        description: '各支付渠道回调验签密钥映射',
        isSystem: true,
      })

      // 3) 最后再切换启用通道和支付方式
      await updateAdminSetting('payment.channels.active', {
        type: 'json',
        value: [String(activeChannel).toUpperCase()],
        category: 'payment',
        description: '启用的支付通道（仅首个生效）',
        isSystem: true,
      })

      await updateAdminSetting('payment.methods.active', {
        type: 'json',
        value: (activeMethods as string[]).map(item => String(item).toUpperCase()),
        category: 'payment',
        description: '启用的支付方式列表',
        isSystem: true,
      })

      // 4) 交给父组件统一触发后端 reload 与前端刷新
      await onReload?.()
      message.success('支付参数已保存并生效')
      await load()
    } catch (error: any) {
      message.error(error?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const disableActions = loading || externalLoading

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="支付参数说明"
        description={
          <div>
            <div>1. 所有配置保存到「系统设置」模块，不新增数据表。</div>
            <div>2. 仅首个启用通道生效，当前支持 WGQPAY 与 MOCK（测试）。</div>
            <div>3. JSON 配置中的敏感字段未修改时会保持原值。</div>
            <div>4. 保存后自动触发后端配置重载，无需手动重启。</div>
          </div>
        }
      />

      <Card title="基础配置" size="small">
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="启用通道（仅首个生效）"
                name="activeChannel"
                rules={[{ required: true, message: '请选择启用通道' }]}
              >
                <Select options={CHANNEL_OPTIONS} placeholder="请选择通道" disabled={disableActions} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                label="启用支付方式"
                name="activeMethods"
                rules={[{ required: true, message: '请选择至少一种支付方式' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="请选择支付方式"
                  options={METHOD_OPTIONS}
                  disabled={disableActions}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="WGQPay 网关配置" size="small">
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={['wgqpay', 'host']} label="API Host" rules={[{ required: true }]}>
                <Input placeholder="https://api.example.com" disabled={disableActions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={['wgqpay', 'merchantNo']} label="商户号" rules={[{ required: true }]}>
                <Input placeholder="商户号" disabled={disableActions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name={['wgqpay', 'secret']}
                label={
                  <span>
                    密钥
                    <Tooltip title="显示为掩码表示未修改，保存时会保留原值">
                      <InfoCircleOutlined style={{ marginLeft: 6 }} />
                    </Tooltip>
                  </span>
                }
                rules={[{ required: true }]}
              >
                <Input.Password placeholder="********" disabled={disableActions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name={['wgqpay', 'payType']} label="支付类型(pay_type)" rules={[{ required: true }]}>
                <Input placeholder="例如：1001" disabled={disableActions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={['wgqpay', 'notifyUrl']} label="回调通知地址" rules={[{ required: true }]}>
                <Input placeholder="https://your.domain/pay/wgqpay/callback" disabled={disableActions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={['wgqpay', 'returnUrl']} label="支付完成跳转地址" rules={[{ required: true }]}>
                <Input placeholder="https://your.domain/return" disabled={disableActions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                name={['wgqpay', 'requestTimeoutMs']}
                label="请求超时(ms)"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={60000} style={{ width: '100%' }} disabled={disableActions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name={['wgqpay', 'requestMaxRetries']}
                label="最大重试次数"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} max={10} style={{ width: '100%' }} disabled={disableActions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name={['wgqpay', 'requestRetryBaseMs']}
                label="重试基准间隔(ms)"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} max={10000} style={{ width: '100%' }} disabled={disableActions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={['wgqpay', 'userAgent']} label="User-Agent" rules={[{ required: true }]}>
                <Input placeholder="Admin-Panel/1.0" disabled={disableActions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name={['wgqpay', 'callerIp']} label="调用方IP">
                <Input placeholder="127.0.0.1" disabled={disableActions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={['wgqpay', 'tradeName']} label="交易名称">
                <Input placeholder="充值" disabled={disableActions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name={['wgqpay', 'callbackMaxSkewSec']}
                label="回调最大时间偏差(s)"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={3600} style={{ width: '100%' }} disabled={disableActions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name={['wgqpay', 'callbackNonceTtlSec']}
                label="回调随机串TTL(s)"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={3600} style={{ width: '100%' }} disabled={disableActions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name={['wgqpay', 'requestContentType']}
                label="请求内容类型"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { label: 'application/json', value: 'application/json' },
                    { label: 'application/x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' },
                  ]}
                  disabled={disableActions}
                />
              </Form.Item>
            </Col>
          </Row>

          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => load()} disabled={disableActions}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={saveAll}
              loading={saving}
              disabled={disableActions}
            >
              保存
            </Button>
          </Space>
        </Form>
      </Card>

      <Card title="高级设置：Webhook 密钥映射" size="small">
        <Form form={form} layout="vertical">
          <Alert
            style={{ marginBottom: 12 }}
            type="info"
            showIcon
            message="说明"
            description={
              <div>
                <div>键为支付通道（如 WGQPAY、MOCK），值为对应的回调验签密钥。</div>
                <div>值若保持为掩码或空白，将保留原密钥。</div>
              </div>
            }
          />
          <Form.List name="webhookSecrets">
            {(fields, { add, remove }) => (
              <>
                {fields.map(field => (
                  <Row key={field.key} gutter={12} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={6}>
                      <Form.Item
                        name={[field.name, 'channel']}
                        label="通道"
                        rules={[{ required: true, message: '请输入通道' }]}
                      >
                        <Input placeholder="WGQPAY / MOCK / ..." disabled={disableActions} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name={[field.name, 'secret']}
                        label="密钥"
                        rules={[{ required: true, message: '请输入密钥或保留掩码' }]}
                      >
                        <Input.Password placeholder="__MASKED__ 或实际密钥" disabled={disableActions} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Space style={{ marginTop: 30 }}>
                        <Button onClick={() => remove(field.name)} disabled={disableActions}>
                          删除
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} block disabled={disableActions}>
                  添加一行
                </Button>
              </>
            )}
          </Form.List>

          <Space style={{ marginTop: 8 }}>
            <Button icon={<ReloadOutlined />} onClick={() => load()} disabled={disableActions}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={saveAll}
              loading={saving}
              disabled={disableActions}
            >
              保存
            </Button>
          </Space>
        </Form>
      </Card>
    </Space>
  )
}

