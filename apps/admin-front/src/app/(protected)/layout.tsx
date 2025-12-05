
'use client'

import { Avatar, Dropdown, Form, Input, Layout, Menu, message, Modal, Result, Spin } from 'antd'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/components/providers/auth-provider'
import { changeAdminPassword } from '@/lib/api'
import type { MenuProps } from 'antd'

const NAV_ITEMS = [
  { key: '/dashboard', label: '面板', path: '/dashboard', permission: 'dashboard' },
  { key: '/roles', label: '角色管理', path: '/roles', permission: 'system.roles' },
  { key: '/menus', label: '菜单管理', path: '/menus', permission: 'system.menus' },
  { key: '/members', label: '用户管理', path: '/members', permission: 'system.members' },
  { key: '/users', label: '管理员', path: '/users', permission: 'system.admins' },
  {
    key: '/payment-orders',
    label: '充值订单',
    path: '/payment-orders',
    permission: 'system.payment-orders',
  },
  { key: '/settings', label: '系统配置', path: '/settings', permission: 'system.settings' },
]

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { session, initializing, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const menuPermissions = session?.admin.menuPermissions ?? []

  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordForm] = Form.useForm()

  const handleChangePassword = useCallback(async () => {
    try {
      const values = await passwordForm.validateFields()
      setPasswordLoading(true)
      await changeAdminPassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      message.success('密码修改成功，请重新登录')
      setPasswordModalOpen(false)
      passwordForm.resetFields()
      logout()
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message)
      }
    } finally {
      setPasswordLoading(false)
    }
  }, [passwordForm])

  const accessibleNavItems = useMemo(
    () => NAV_ITEMS.filter(item => !item.permission || menuPermissions.includes(item.permission)),
    [menuPermissions],
  )

  const selectedKeys = useMemo(() => {
    const current = accessibleNavItems.find(item => pathname?.startsWith(item.path))
    return current ? [current.key] : []
  }, [accessibleNavItems, pathname])

  const canAccessCurrent = useMemo(() => {
    if (!pathname) return true
    return accessibleNavItems.some(item => pathname.startsWith(item.path))
  }, [accessibleNavItems, pathname])

  useEffect(() => {
    if (!initializing && !session) {
      router.replace('/login')
    }
  }, [initializing, session, router])

  useEffect(() => {
    if (!initializing && session && accessibleNavItems.length && !canAccessCurrent) {
      router.replace(accessibleNavItems[0].path)
    }
  }, [accessibleNavItems, canAccessCurrent, initializing, router, session])

  const dropdownMenu: MenuProps = {
    items: [
      {
        key: 'username',
        label: `当前账号：${session?.admin.username ?? '-'}`,
        disabled: true,
      },
      { type: 'divider' },
      { key: 'changePassword', label: '修改密码' },
      { key: 'logout', label: '退出登录' },
    ],
    onClick: ({ key }) => {
      if (key === 'changePassword') {
        setPasswordModalOpen(true)
      } else if (key === 'logout') {
        logout()
      }
    },
  }

  if (initializing || (!session && typeof window !== 'undefined')) {
    return (
      <div className="center-container">
        <Spin size="large" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <Layout className="app-shell">
      <Layout.Sider breakpoint="lg" collapsedWidth="0" className="app-sider">
        <div className="app-logo">Admin Scaffold</div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={selectedKeys}
          items={accessibleNavItems.map(item => ({
            key: item.key,
            label: item.label,
            onClick: () => router.push(item.path),
          }))}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="app-header">
          <Dropdown menu={dropdownMenu} placement="bottomRight" trigger={['click']}>
            <div className="user-avatar">
              <Avatar size="small">{session.admin.username.slice(0, 1).toUpperCase()}</Avatar>
              <span>{session.admin.username}</span>
            </div>
          </Dropdown>
        </Layout.Header>
        <Layout.Content className="app-content">
          {accessibleNavItems.length === 0 ? (
            <Result status="403" title="暂无菜单权限" subTitle="请联系管理员为该账号分配菜单权限。" />
          ) : canAccessCurrent ? (
            children
          ) : (
            <Result status="403" title="无访问权限" subTitle="您没有访问该页面的权限，已自动限制。" />
          )}
        </Layout.Content>
      </Layout>

      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onOk={handleChangePassword}
        onCancel={() => {
          setPasswordModalOpen(false)
          passwordForm.resetFields()
        }}
        confirmLoading={passwordLoading}
        okText="确认修改"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={passwordForm} layout="vertical" autoComplete="off">
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[
              { required: true, message: '请输入当前密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              { min: 6, message: '密码至少6位' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的新密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
