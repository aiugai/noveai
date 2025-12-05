import { randomUUID } from 'node:crypto'
import { INestApplication } from '@nestjs/common'

import { supertestRequest as request } from '../helpers/supertest-compat'
import { API_PREFIX, bootstrapE2eApp } from '../fixtures/fixtures'
import { createAuthorizedRequest, registerTestAdmin, randomString } from './admin-test.utils'

describe('[TC-ADMUSR-001] AdminUserController (e2e)', () => {
  let app: INestApplication
  let token: string

  beforeAll(async () => {
    const { app: testingApp } = await bootstrapE2eApp()
    app = testingApp
    const admin = await registerTestAdmin(app)
    token = admin.token
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('[TC-ADMUSR-002] should perform admin user CRUD and password reset', async () => {
    const client = createAuthorizedRequest(app, token)
    const basePath = `/${API_PREFIX}/admin/users`

    // 列表应至少包含当前管理员
    const listRes = await client.get(basePath).expect(200)
    expect(Array.isArray(listRes.body)).toBe(true)
    expect(listRes.body.length).toBeGreaterThanOrEqual(1)

    // 创建新管理员
    const newAdminPayload = {
      username: randomString('adm_user'),
      password: `Pwd_${randomUUID().slice(0, 8)}`,
      email: `${randomString('adm')}@example.com`,
      nickName: '测试管理员',
    }
    const createRes = await client.post(basePath).send(newAdminPayload).expect(201)
    const createdId = createRes.body.id as string
    expect(createRes.body).toMatchObject({
      username: newAdminPayload.username,
      email: newAdminPayload.email,
      nickName: newAdminPayload.nickName,
      isFrozen: false,
      roles: [],
    })

    // 创建角色并关联到该管理员
    const rolePayload = {
      code: randomString('role'),
      name: '内容审核员',
      description: '负责审核',
      menuPermissions: ['read:*'],
    }
    const roleRes = await client.post(`/${API_PREFIX}/admin/roles`).send(rolePayload).expect(201)

    const updateRes = await client
      .patch(`${basePath}/${createdId}`)
      .send({
        nickName: '新的昵称',
        isFrozen: true,
        roleIds: [roleRes.body.id],
      })
      .expect(200)
    expect(updateRes.body.nickName).toBe('新的昵称')
    expect(updateRes.body.isFrozen).toBe(true)
    expect(updateRes.body.roles).toHaveLength(1)

    await client
      .patch(`${basePath}/${createdId}`)
      .send({ isFrozen: false })
      .expect(200)

    const newPassword = `Reset_${randomUUID().slice(0, 8)}`
    await client
      .post(`${basePath}/${createdId}/reset-password`)
      .send({ newPassword })
      .expect(res => {
        expect([200, 201]).toContain(res.status)
      })

    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/auth/login`)
      .send({ username: newAdminPayload.username, password: newPassword })
      .expect(200)
  })
})
