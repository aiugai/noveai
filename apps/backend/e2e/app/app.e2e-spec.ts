import { INestApplication } from '@nestjs/common'
import { supertestRequest as request } from '../helpers/supertest-compat'
import { API_PREFIX, bootstrapE2eApp } from '../fixtures/fixtures'

describe('AppController (e2e)', () => {
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

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get(`/${API_PREFIX}/`).expect(200).expect('Hello World!')
  })
})
