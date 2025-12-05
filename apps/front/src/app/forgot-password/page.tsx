'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

import { mockRequestResetPassword } from '@/mock'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await mockRequestResetPassword(email)
      setMessage('重置链接已发送（Mock）')
    } catch (_err: any) {
      setError('请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
        <div style={{ width: '100%', maxWidth: 420 }}>
        <div className="form-card">
            <h2 style={{ marginTop: 0 }}>找回密码</h2>
            
            {!message ? (
            <form onSubmit={submitRequest}>
                <p style={{ color: '#94a3b8' }}>输入注册邮箱，我们会发送重置链接。</p>
                <label>
                邮箱地址
                <input
                    className="input-field"
                    type="email"
                    required
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="you@example.com"
                />
                </label>
                {error && <p className="error-text">{error}</p>}
                <button className="primary" type="submit" disabled={loading}>
                {loading ? '发送中...' : '发送重置链接'}
                </button>
            </form>
            ) : (
                <div>
                    <p className="success-text" style={{ fontSize: 18, marginBottom: 16 }}>{message}</p>
                    <p style={{ color: '#94a3b8' }}>请检查您的邮箱（模拟）并点击链接重置密码。</p>
                </div>
            )}

            <div style={{ marginTop: 16, textAlign: 'left' }}>
            <Link href="/login">返回登录</Link>
            </div>
        </div>
        </div>
    </div>
  )
}
