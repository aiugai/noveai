import { randomUUID } from 'node:crypto'
import { INestApplication } from '@nestjs/common'

import { supertestRequest as request } from '../helpers/supertest-compat'
import { API_PREFIX, bootstrapE2eApp } from '../fixtures/fixtures'
import { registerTestAdmin } from './admin-test.utils'
import { PrismaService } from '../../src/prisma/prisma.service'

describe('[TC-SET-001] AdminSettingsController (e2e)', () => {
  const basePath = `/${API_PREFIX}/admin/settings`
  let app: INestApplication
  let adminToken: string
  let prisma: PrismaService

  beforeAll(async () => {
    const { app: testingApp, prisma: prismaService } = await bootstrapE2eApp()
    app = testingApp
    prisma = prismaService

    // 通过注册接口创建管理员用户并获取 token
    const adminAuth = await registerTestAdmin(app)
    adminToken = adminAuth.token
  })

  afterAll(async () => {
    // 清理测试数据
    await prisma.systemSetting.deleteMany({
      where: {
        key: { startsWith: 'test.' },
      },
    })
    if (app) {
      await app.close()
    }
  })

  describe('POST /admin/settings - Create setting', () => {
    it('[TC-SET-002] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(basePath)
        .send(buildCreatePayload())
        .expect(401)
    })

    it('[TC-SET-003] should create string type setting successfully', async () => {
      const payload = buildCreatePayload({ type: 'string' })

      const { body } = await request(app.getHttpServer())
        .post(basePath)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201)

      expect(body).toMatchObject({
        id: expect.any(String),
        key: payload.key,
        value: payload.value,
        type: 'string',
        category: payload.category,
        isSystem: false,
      })
    })

    it('[TC-SET-004] should create number type setting successfully', async () => {
      const payload = buildCreatePayload({ type: 'number', value: '100' })

      const { body } = await request(app.getHttpServer())
        .post(basePath)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201)

      expect(body.type).toBe('number')
      expect(body.value).toBe('100')
    })

    it('[TC-SET-005] should create boolean type setting successfully', async () => {
      const payload = buildCreatePayload({ type: 'boolean', value: 'true' })

      const { body } = await request(app.getHttpServer())
        .post(basePath)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201)

      expect(body.type).toBe('boolean')
      expect(body.value).toBe('true')
    })

    it('[TC-SET-006] should create JSON type setting successfully', async () => {
      const jsonValue = { name: 'test', enabled: true, count: 10 }
      const payload = buildCreatePayload({ type: 'json', value: JSON.stringify(jsonValue) })

      const { body } = await request(app.getHttpServer())
        .post(basePath)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201)

      expect(body.type).toBe('json')
      expect(JSON.parse(body.value)).toEqual(jsonValue)
    })

    it('[TC-SET-007] should create system setting successfully', async () => {
      const payload = buildCreatePayload({ isSystem: true })

      const { body } = await request(app.getHttpServer())
        .post(basePath)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201)

      expect(body.isSystem).toBe(true)
    })

    it('[TC-SET-008] should return 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post(basePath)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'only description' })
        .expect(400)
    })
  })

  describe('GET /admin/settings - Get settings list', () => {
    beforeAll(async () => {
      // 创建测试数据
      await prisma.systemSetting.createMany({
        data: [
          { key: 'test.list.item1', value: 'value1', type: 'string', category: 'test_category_a' },
          { key: 'test.list.item2', value: 'value2', type: 'string', category: 'test_category_a' },
          { key: 'test.list.item3', value: 'value3', type: 'string', category: 'test_category_b' },
        ],
        skipDuplicates: true,
      })
    })

    it('[TC-SET-009] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(basePath)
        .expect(401)
    })

    it('[TC-SET-010] should get all settings successfully', async () => {
      const { body } = await request(app.getHttpServer())
        .get(basePath)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBeGreaterThanOrEqual(3)
    })

    it('[TC-SET-011] should filter settings by category successfully', async () => {
      const { body } = await request(app.getHttpServer())
        .get(basePath)
        .query({ category: 'test_category_a' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBe(2)
      body.forEach((item: any) => {
        expect(item.category).toBe('test_category_a')
      })
    })

    it('[TC-SET-012] should mask sensitive setting values', async () => {
      // 创建敏感配置
      await prisma.systemSetting.upsert({
        where: { key: 'test.api.secret' },
        update: { value: 'super_secret_key_12345' },
        create: {
          key: 'test.api.secret',
          value: 'super_secret_key_12345',
          type: 'string',
          category: 'test',
        },
      })

      const { body } = await request(app.getHttpServer())
        .get(basePath)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const secretSetting = body.find((item: any) => item.key === 'test.api.secret')
      expect(secretSetting).toBeDefined()
      // 敏感值应该被脱敏（包含 ****）
      expect(secretSetting.value).toContain('****')
      expect(secretSetting.value).not.toBe('super_secret_key_12345')
    })
  })

  describe('PUT /admin/settings/:key - Update setting', () => {
    const testKey = 'test.update.target'

    beforeAll(async () => {
      await prisma.systemSetting.upsert({
        where: { key: testKey },
        update: { value: 'original_value' },
        create: {
          key: testKey,
          value: 'original_value',
          type: 'string',
          category: 'test',
        },
      })
    })

    it('[TC-SET-013] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .put(`${basePath}/${testKey}`)
        .send({ value: 'new_value' })
        .expect(401)
    })

    it('[TC-SET-014] should update setting value successfully', async () => {
      const { body } = await request(app.getHttpServer())
        .put(`${basePath}/${testKey}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'updated_value' })
        .expect(200)

      expect(body.key).toBe(testKey)
      expect(body.value).toBe('updated_value')
    })

    it('[TC-SET-015] should update setting type successfully', async () => {
      const { body } = await request(app.getHttpServer())
        .put(`${basePath}/${testKey}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: '123', type: 'number' })
        .expect(200)

      expect(body.type).toBe('number')
      expect(body.value).toBe('123')
    })

    it('[TC-SET-016] should update setting description successfully', async () => {
      const newDescription = '更新后的描述'
      const { body } = await request(app.getHttpServer())
        .put(`${basePath}/${testKey}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'any_value', description: newDescription })
        .expect(200)

      expect(body.description).toBe(newDescription)
    })

    it('[TC-SET-017] should create non-existent setting (upsert behavior)', async () => {
      const newKey = `test.new.${randomUUID().slice(0, 8)}`

      const { body } = await request(app.getHttpServer())
        .put(`${basePath}/${newKey}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'brand_new_value', category: 'test' })
        .expect(200)

      expect(body.key).toBe(newKey)
      expect(body.value).toBe('brand_new_value')
    })
  })

  describe('PATCH /admin/settings - Reload settings', () => {
    it('[TC-SET-018] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .patch(basePath)
        .expect(401)
    })

    it('[TC-SET-019] should reload settings successfully', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(basePath)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(body).toEqual({ success: true })
    })
  })

  describe('JSON setting special scenarios', () => {
    it('[TC-SET-020] should return error for invalid JSON format', async () => {
      const payload = {
        key: `test.invalid.json.${randomUUID().slice(0, 8)}`,
        value: 'not a valid json',
        type: 'json',
        category: 'test',
      }

      const response = await request(app.getHttpServer())
        .post(basePath)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)

      // JSON 类型但无法解析应该返回错误
      expect(response.status).toBe(400)
    })

    it('[TC-SET-021] should mask sensitive fields in JSON setting', async () => {
      const sensitiveJson = {
        apiKey: 'my_secret_api_key',
        config: {
          token: 'my_secret_token',
          name: 'visible_name',
        },
      }

      // 使用精确匹配的敏感 key（payment.wgqpay 是 isSensitiveKeyPath 中定义的敏感 key）
      const key = 'payment.wgqpay'
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: JSON.stringify(sensitiveJson), type: 'json' },
        create: {
          key,
          value: JSON.stringify(sensitiveJson),
          type: 'json',
          category: 'payment',
        },
      })

      const { body } = await request(app.getHttpServer())
        .get(basePath)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const setting = body.find((item: any) => item.key === key)
      expect(setting).toBeDefined()

      const maskedValue = JSON.parse(setting.value)
      // apiKey 和 token 应该被脱敏
      expect(maskedValue.apiKey).toContain('****')
      expect(maskedValue.config.token).toContain('****')
      // name 不是敏感字段，应该保持原值
      expect(maskedValue.config.name).toBe('visible_name')
    })
  })
})

/**
 * 构建创建配置的测试数据
 */
function buildCreatePayload(overrides: Partial<{
  key: string
  value: string
  type: string
  description: string
  category: string
  isSystem: boolean
}> = {}) {
  const suffix = randomUUID().slice(0, 8)
  return {
    key: `test.setting.${suffix}`,
    value: `test_value_${suffix}`,
    type: 'string',
    description: `测试配置_${suffix}`,
    category: 'test',
    isSystem: false,
    ...overrides,
  }
}
