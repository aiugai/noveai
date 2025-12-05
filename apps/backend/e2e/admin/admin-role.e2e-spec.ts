import { INestApplication } from '@nestjs/common'

import { API_PREFIX, bootstrapE2eApp } from '../fixtures/fixtures'
import { createAuthorizedRequest, registerTestAdmin, randomString } from './admin-test.utils'

describe('[TC-ADMROLE-001] RoleController (e2e)', () => {
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

  it('[TC-ADMROLE-002] should perform role CRUD operations', async () => {
    const client = createAuthorizedRequest(app, token)
    const basePath = `/${API_PREFIX}/admin/roles`

    const createPayload = {
      code: randomString('role_code'),
      name: '运营',
      description: '负责活动配置',
      menuPermissions: ['read:dashboard', 'create:activity'],
    }
    const createRes = await client.post(basePath).send(createPayload).expect(201)
    const roleId = createRes.body.id as string
    expect(createRes.body).toMatchObject({
      code: createPayload.code,
      name: createPayload.name,
      menuPermissions: createPayload.menuPermissions,
    })

    const listRes = await client.get(basePath).expect(200)
    expect(listRes.body.some((role: any) => role.id === roleId)).toBe(true)

    const updateRes = await client
      .patch(`${basePath}/${roleId}`)
      .send({ name: '运营管理员', description: '活动+内容', menuPermissions: ['read:*'] })
      .expect(200)
    expect(updateRes.body).toMatchObject({
      name: '运营管理员',
      menuPermissions: ['read:*'],
    })

    await client.delete(`${basePath}/${roleId}`).expect(200)

    const listAfterDelete = await client.get(basePath).expect(200)
    expect(listAfterDelete.body.find((role: any) => role.id === roleId)).toBeUndefined()
  })
})
