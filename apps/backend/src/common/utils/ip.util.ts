export function getClientIp(req: any): string {
  try {
    // 仅在启用 trust proxy 时才采信 X-Forwarded-For，避免被伪造
    const trustProxy = Boolean(req?.app?.get?.('trust proxy'))
    if (trustProxy) {
      const xff = (req?.headers?.['x-forwarded-for'] || req?.headers?.['X-Forwarded-For']) as
        | string
        | undefined
      if (xff && typeof xff === 'string') {
        const parts = xff
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
        if (parts.length > 0) {
          // 支持通过 app.get('trust proxy hops') 指定从右向左回溯的层数
          const hops = Number(req?.app?.get?.('trust proxy hops') || 0)
          const index = hops > 0 ? Math.max(parts.length - 1 - hops, 0) : 0
          const ip = parts[index]
          if (ip) return ip
        }
      }
    }
    const ip =
      (req?.ip as string | undefined) ||
      (req?.socket?.remoteAddress as string | undefined) ||
      (req?.connection?.remoteAddress as string | undefined) ||
      'unknown'
    return ip
  } catch {
    return 'unknown'
  }
}
