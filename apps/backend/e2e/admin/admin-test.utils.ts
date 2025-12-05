import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'

import { supertestRequest as request } from '../helpers/supertest-compat'
import { API_PREFIX } from '../fixtures/fixtures'

export interface AdminAuthContext {
  token: string
  adminId: string
  username: string
  password: string
  email: string
  nickName: string
}

export function createAuthorizedRequest(app: INestApplication, token: string) {
  const server = app.getHttpServer()
  return {
    get: (url: string) => request(server).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(server).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(server).patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(server).delete(url).set('Authorization', `Bearer ${token}`),
  }
}

export async function registerTestAdmin(app: INestApplication): Promise<AdminAuthContext> {
  const payload = buildAdminRegisterPayload()
  const { body } = await request(app.getHttpServer())
    .post(`/${API_PREFIX}/admin/auth/register`)
    .send(payload)
    .expect(201)

  return {
    token: body.accessToken as string,
    adminId: body.admin.id as string,
    ...payload,
  }
}

export function buildAdminRegisterPayload() {
  const suffix = randomUUID().slice(0, 8)
  return {
    username: `admin_${suffix}`,
    password: `Pwd_${suffix}`,
    email: `admin_${suffix}@example.com`,
    nickName: `管理员${suffix}`,
  }
}

export function randomString(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 8)}`
}
