import { randomUUID } from 'node:crypto'
import { INestApplication } from '@nestjs/common'

import { supertestRequest as request } from '../helpers/supertest-compat'
import { API_PREFIX, bootstrapE2eApp } from '../fixtures/fixtures'

describe('[TC-ADM-001] AdminAuthController (e2e)', () => {
  const basePath = `/${API_PREFIX}/admin/auth`
  let app: INestApplication

  beforeAll(async () => {
    const { app: testingApp } = await bootstrapE2eApp()
    app = testingApp
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('[TC-ADM-002] should register admin successfully', async () => {
    const payload = buildRegisterPayload()

    const { body } = await request(app.getHttpServer()).post(`${basePath}/register`).send(payload).expect(201)

    expect(body).toMatchObject({
      accessToken: expect.any(String),
      admin: {
        username: payload.username,
        email: payload.email,
        nickName: payload.nickName,
        isFrozen: false,
        menuPermissions: [],
      },
    })
  })

  it('[TC-ADM-003] should return token on successful login', async () => {
    const payload = buildRegisterPayload()
    await request(app.getHttpServer()).post(`${basePath}/register`).send(payload).expect(201)

    const { body } = await request(app.getHttpServer())
      .post(`${basePath}/login`)
      .send({ username: payload.username, password: payload.password })
      .expect(200)

    expect(body.accessToken).toEqual(expect.any(String))
    expect(body.admin.username).toBe(payload.username)
  })

  it('[TC-ADM-004] should get current admin with valid token', async () => {
    const payload = buildRegisterPayload()
    const registerRes = await request(app.getHttpServer()).post(`${basePath}/register`).send(payload).expect(201)

    const token = registerRes.body.accessToken as string
    const { body } = await request(app.getHttpServer())
      .get(`${basePath}/me`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(body).toMatchObject({
      username: payload.username,
      email: payload.email,
      nickName: payload.nickName,
      isFrozen: false,
    })
  })

  it('[TC-ADM-005] should return 401 when accessing /me without token', async () => {
    await request(app.getHttpServer()).get(`${basePath}/me`).expect(401)
  })
})

function buildRegisterPayload() {
  const suffix = randomUUID().slice(0, 8)
  return {
    username: `admin_${suffix}`,
    password: `Passw0rd_${suffix}`,
    email: `admin_${suffix}@example.com`,
    nickName: `管理员_${suffix}`,
  }
}
