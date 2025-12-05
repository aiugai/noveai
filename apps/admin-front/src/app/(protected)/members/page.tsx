'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { SearchOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'

import {
  CreateFrontUserPayload,
  FrontUser,
  FrontUserListQuery,
  FrontUserListResponse,
  ResetFrontUserPasswordPayload,
  UpdateFrontUserPayload,
  createFrontUser,
  deleteFrontUser,
  fetchFrontUsers,
  resetFrontUserPassword,
  updateFrontUser,
} from '@/lib/api'

interface MemberFormValues {
  email: string
  nickname?: string
  password?: string
  status?: FrontUser['status']
}

interface FilterFormValues {
  keyword?: string
  status?: FrontUser['status']
}

interface ResetPasswordFormValues {
  newPassword: string
}

const statusOptions: Array<{ label: string; value: FrontUser['status']; color: string }> = [
  { label: '正常', value: 'active', color: 'green' },
  { label: '未激活', value: 'inactive', color: 'blue' },
  { label: '已冻结', value: 'suspended', color: 'orange' },
  { label: '已封禁', value: 'banned', color: 'red' },
]

export default function MembersPage() {
  const { message } = App.useApp()
  const [filterForm] = Form.useForm<FilterFormValues>()
  const [form] = Form.useForm<MemberFormValues>()
  const [passwordForm] = Form.useForm<ResetPasswordFormValues>()

  const [members, setMembers] = useState<FrontUser[]>([])
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number }>({
    total: 0,
    page: 1,
    limit: 20,
  })
  const [query, setQuery] = useState<FrontUserListQuery>({ page: 1, limit: 20 })
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<FrontUser | null>(null)
  const [passwordTarget, setPasswordTarget] = useState<FrontUser | null>(null)

  const loadMembers = useCallback(
    async (params: FrontUserListQuery) => {
      setLoading(true)
      try {
        const response: FrontUserListResponse = await fetchFrontUsers(params)
        setMembers(response.items)
        setPagination({ total: response.total, page: response.page, limit: response.limit })
      } catch (error: any) {
        message.error(error?.message ?? '获取用户失败')
      } finally {
        setLoading(false)
      }
    },
    [message],
  )

  useEffect(() => {
    loadMembers(query)
  }, [loadMembers, query])

  const handleTableChange = (pageConfig: TablePaginationConfig) => {
    setQuery((prev: FrontUserListQuery) => ({
      ...prev,
      page: pageConfig.current ?? prev.page ?? 1,
      limit: pageConfig.pageSize ?? prev.limit ?? 20,
    }))
  }

  const handleFilterSubmit = (values: FilterFormValues) => {
    setQuery((prev: FrontUserListQuery) => ({
      ...prev,
      page: 1,
      keyword: values.keyword?.trim() || undefined,
      status: values.status || undefined,
    }))
  }

  const handleFilterReset = () => {
    filterForm.resetFields()
    setQuery((prev: FrontUserListQuery) => ({
      ...prev,
      page: 1,
      keyword: undefined,
      status: undefined,
    }))
  }

  const openCreateModal = () => {
    setCurrentUser(null)
    form.resetFields()
    form.setFieldsValue({ status: 'active' })
    setModalOpen(true)
  }

  const openEditModal = (user: FrontUser) => {
    setCurrentUser(user)
    form.setFieldsValue({
      email: user.email,
      nickname: user.nickname ?? undefined,
      status: user.status,
    })
    setModalOpen(true)
  }

  const openPasswordModal = (user: FrontUser) => {
    setPasswordTarget(user)
    passwordForm.resetFields()
    setPasswordModalOpen(true)
  }

  const handleMemberSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (currentUser) {
        const payload: UpdateFrontUserPayload = {
          email: values.email,
          nickname: values.nickname,
          status: values.status,
        }
        await updateFrontUser(currentUser.id, payload)
        message.success('用户已更新')
      } else {
        const payload: CreateFrontUserPayload = {
          email: values.email,
          password: values.password!,
          nickname: values.nickname ?? undefined,
          status: values.status,
        }
        await createFrontUser(payload)
        message.success('用户已创建')
      }
      setModalOpen(false)
      // 新建/编辑后回到第一页，重新加载数据
      setQuery((prev: FrontUserListQuery) => ({
        ...prev,
        page: 1,
      }))
    } catch (error: any) {
      if (error?.message) {
        message.error(error.message)
      }
    }
  }

  const handleDelete = async (user: FrontUser) => {
    try {
      await deleteFrontUser(user.id)
      message.success('用户已冻结并隐藏')
      // 删除（冻结+软删）后回到第一页，重新加载数据
      setQuery((prev: FrontUserListQuery) => ({
        ...prev,
        page: 1,
      }))
    } catch (error: any) {
      message.error(error?.message ?? '操作失败')
    }
  }

  const handleResetPassword = async () => {
    if (!passwordTarget) return
    try {
      const values = await passwordForm.validateFields()
      const payload: ResetFrontUserPasswordPayload = { newPassword: values.newPassword }
      await resetFrontUserPassword(passwordTarget.id, payload)
      message.success('密码已重置')
      setPasswordModalOpen(false)
    } catch (error: any) {
      if (error?.message) {
        message.error(error.message)
      }
    }
  }

  const columns: ColumnsType<FrontUser> = [
    { title: '邮箱', dataIndex: 'email' },
    { title: '昵称', dataIndex: 'nickname', render: value => value || '—' },
    {
      title: '状态',
      dataIndex: 'status',
      render: status => {
        const option = statusOptions.find(item => item.value === status)
        return <Tag color={option?.color}>{option?.label ?? status}</Tag>
      },
    },
    {
      title: '邮箱验证',
      dataIndex: 'emailVerified',
      render: verified => <Tag color={verified ? 'green' : 'default'}>{verified ? '已验证' : '未验证'}</Tag>,
    },
    {
      title: '游客账号',
      dataIndex: 'isGuest',
      render: value => <Tag color={value ? 'gold' : 'default'}>{value ? '游客' : '正式'}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: value => new Date(value).toLocaleString(),
    },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Button type="link" onClick={() => openPasswordModal(record)}>
            重置密码
          </Button>
          <Popconfirm title="确定冻结并隐藏该用户？" onConfirm={() => handleDelete(record)}>
            <Button type="link" danger>
              冻结并隐藏
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card>
          <Form layout="inline" form={filterForm} onFinish={handleFilterSubmit}>
            <Form.Item name="keyword">
              <Space.Compact>
                <Input
                  allowClear
                  placeholder="邮箱或昵称"
                  onPressEnter={() => filterForm.submit()}
                  style={{ width: 180 }}
                />
                <Button icon={<SearchOutlined />} onClick={() => filterForm.submit()} />
              </Space.Compact>
            </Form.Item>
            <Form.Item name="status">
              <Select
                allowClear
                placeholder="账户状态"
                style={{ width: 160 }}
                options={statusOptions.map(item => ({ label: item.label, value: item.value }))}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  搜索
                </Button>
                <Button onClick={handleFilterReset}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title="前台用户管理"
          extra={
            <Button type="primary" onClick={openCreateModal}>
              新建用户
            </Button>
          }
        >
          <Table<FrontUser>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={members}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 位用户`,
            }}
            onChange={handleTableChange}
          />
        </Card>
      </Space>

      <Modal
        destroyOnHidden
        title={currentUser ? '编辑用户' : '新建用户'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleMemberSubmit}
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input placeholder="user@example.com" />
          </Form.Item>
          {!currentUser && (
            <Form.Item
              label="初始密码"
              name="password"
              rules={[{ required: true, min: 6, message: '请输入至少 6 位密码' }]}
            >
              <Input.Password placeholder="••••••" />
            </Form.Item>
          )}
          <Form.Item label="昵称" name="nickname">
            <Input placeholder="可选昵称" />
          </Form.Item>
          <Form.Item label="账户状态" name="status" rules={[{ required: true, message: '请选择账户状态' }]}>
            <Select options={statusOptions.map(item => ({ label: item.label, value: item.value }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        title={passwordTarget ? `重置密码：${passwordTarget.email}` : '重置密码'}
        open={passwordModalOpen}
        onCancel={() => setPasswordModalOpen(false)}
        onOk={handleResetPassword}
      >
        <Form layout="vertical" form={passwordForm}>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[{ required: true, min: 6, message: '请输入至少 6 位密码' }]}
          >
            <Input.Password placeholder="新的登录密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
