import { INestApplication } from '@nestjs/common'
import { supertestRequest as request } from '../helpers/supertest-compat'
import { API_PREFIX, bootstrapE2eApp } from '../fixtures/fixtures'

describe('HealthController (e2e)', () => {
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

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/health`)
      .expect(200)
      .expect(res => {
        expect(res.body).toHaveProperty('status', 'ok')
        expect(res.body).toHaveProperty('timestamp')
        expect(res.body).toHaveProperty('backendVersion')
        expect(res.body.backendVersion).toMatchObject({
          app: '@ai/backend',
        })
        expect(typeof res.body.backendVersion.version).toBe('string')
        expect(res.body.backendVersion.runtime).toBeDefined()
      })
  })
})
