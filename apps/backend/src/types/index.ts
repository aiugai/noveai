export type TokenType = 'access' | 'refresh'

export interface JwtUserData {
  id: string
  username: string
  isSuperAdmin: boolean
  menuPermissions: string[]
  featurePermissions: string[]
  apiPermissions: string[]
  tokenType: TokenType
}

// Fastify 中扩展请求的 user 字段（仅类型声明，不会生成代码）
declare module 'fastify' {
  interface FastifyRequest {
    user: JwtUserData
  }
}
