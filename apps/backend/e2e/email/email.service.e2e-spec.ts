import { INestApplication } from '@nestjs/common'

import { bootstrapE2eApp } from '../fixtures/fixtures'
import { EmailService } from 'src/modules/email/email.service'
import { E2eEnvKey, getEnvStr, setEnv } from '../fixtures/e2e-env'

describe('[TC-EMAIL-001] EmailService (e2e)', () => {
  let app: INestApplication
  let emailService: EmailService

  beforeAll(async () => {
    setEnv(E2eEnvKey.EMAIL_FIXED_CODE, getEnvStr(E2eEnvKey.EMAIL_FIXED_CODE) || '654321')
    setEnv(E2eEnvKey.JWT_SECRET, getEnvStr(E2eEnvKey.JWT_SECRET) || 'test_jwt_secret')
    const { app: testingApp } = await bootstrapE2eApp()
    app = testingApp
    emailService = app.get(EmailService)
    emailService.clearTestEmails()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  afterEach(() => {
    emailService?.clearTestEmails()
  })

  it('[TC-EMAIL-002] should store emails in memory in test environment', async () => {
    const payload = {
      to: 'user@example.com',
      subject: 'Integration Test Email',
      html: '<p>Hello Integration</p>',
      text: 'Hello Integration',
    }

    await emailService.sendEmail(payload)

    const storedEmails = emailService.getTestEmails()
    expect(storedEmails).toHaveLength(1)
    expect(storedEmails[0]).toMatchObject({
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    })
    expect(storedEmails[0].html).toContain('Hello Integration')
    expect(storedEmails[0].timestamp).toBeInstanceOf(Date)
  })

  it('[TC-EMAIL-003] should generate secure template and extractable verification code', async () => {
    const recipient = 'verify@example.com'
    const code = '987654'
    await emailService.sendVerificationEmail({
      email: recipient,
      code,
      userName: '<script>alert(1)</script>',
    })

    const emails = emailService.findTestEmailByRecipient(recipient)
    expect(emails).toHaveLength(1)
    expect(emails[0].html).not.toContain('<script>')

    const extractedCode = emailService.extractVerificationCodeFromEmail(emails[0].html)
    expect(extractedCode).toBe(code)
  })

  it('[TC-EMAIL-004] should return fixed verification code in test environment', () => {
    const generatedCode = emailService.generateVerificationCode()
    expect(generatedCode).toBe('654321')
  })
})
