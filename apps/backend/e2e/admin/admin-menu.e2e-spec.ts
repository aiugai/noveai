import { INestApplication } from '@nestjs/common'
import { AdminMenuType } from '@prisma/client'

import { API_PREFIX, bootstrapE2eApp } from '../fixtures/fixtures'
import { createAuthorizedRequest, registerTestAdmin, randomString } from './admin-test.utils'

describe('[TC-ADMMENU-001] MenuController (e2e)', () => {
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

  it('[TC-ADMMENU-002] should perform menu CRUD operations', async () => {
    const client = createAuthorizedRequest(app, token)
    const basePath = `/${API_PREFIX}/admin/menus`

    const createPayload = {
      type: AdminMenuType.MENU,
      title: `仪表盘-${randomString('menu')}`,
      code: randomString('menu_code'),
      path: '/dashboard',
      icon: 'dashboard',
      sort: 1,
      isShow: true,
    }
    const createRes = await client.post(basePath).send(createPayload).expect(201)
    const menuId = createRes.body.id as string
    expect(createRes.body.title).toBe(createPayload.title)

    const listRes = await client.get(basePath).expect(200)
    expect(listRes.body.some((menu: any) => menu.id === menuId)).toBe(true)

    const treeRes = await client.get(`${basePath}/tree`).expect(200)
    expect(Array.isArray(treeRes.body)).toBe(true)

    const updateRes = await client
      .patch(`${basePath}/${menuId}`)
      .send({ title: '更新后的标题', sort: 2, isShow: false, type: AdminMenuType.MENU })
      .expect(200)
    expect(updateRes.body).toMatchObject({ title: '更新后的标题', sort: 2, isShow: false })

    await client.delete(`${basePath}/${menuId}`).expect(200)

    const listAfterDelete = await client.get(basePath).expect(200)
    expect(listAfterDelete.body.find((menu: any) => menu.id === menuId)).toBeUndefined()
  })
})
