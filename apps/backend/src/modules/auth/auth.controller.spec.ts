import { Test, TestingModule } from '@nestjs/testing'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { RegisterRequestDto } from './dto/requests/register.request.dto'
import { LoginRequestDto } from './dto/requests/login.request.dto'
import { VerifyEmailRequestDto } from './dto/requests/verify-email.request.dto'
import { ResendVerificationRequestDto } from './dto/requests/resend-verification.request.dto'
import { PasswordResetRequestDto } from './dto/requests/password-reset.request.dto'
import { VerifyPasswordResetRequestDto } from './dto/requests/verify-password-reset.request.dto'
import { ChangePasswordRequestDto } from './dto/requests/change-password.request.dto'
import { AuthResponseDto } from './dto/responses/auth.response.dto'

describe('authController', () => {
  let controller: AuthController
  let authService: jest.Mocked<AuthService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            verifyEmail: jest.fn(),
            resendVerification: jest.fn(),
            requestPasswordReset: jest.fn(),
            verifyPasswordReset: jest.fn(),
            changePassword: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get(AuthController)
    authService = module.get(AuthService) as jest.Mocked<AuthService>
  })

  describe('register', () => {
    it('should delegate to authService and return its result', async () => {
      const dto: RegisterRequestDto = {
        email: 'user@example.com',
        password: 'Password1!',
        nickname: 'tester',
      }
      const authResponse = createAuthResponse()
      authService.register.mockResolvedValue(authResponse)

      await expect(controller.register(dto)).resolves.toEqual(authResponse)
      expect(authService.register).toHaveBeenCalledWith(dto)
    })
  })

  describe('login', () => {
    it('should delegate to authService.login', async () => {
      const dto: LoginRequestDto = { email: 'user@example.com', password: 'Password1!' }
      const authResponse = createAuthResponse()
      authService.login.mockResolvedValue(authResponse)

      await expect(controller.login(dto)).resolves.toEqual(authResponse)
      expect(authService.login).toHaveBeenCalledWith(dto)
    })
  })

  describe('verifyEmail', () => {
    it('should call authService.verifyEmail', async () => {
      const dto: VerifyEmailRequestDto = { email: 'user@example.com', code: '123456' }
      authService.verifyEmail.mockResolvedValue(undefined)

      await expect(controller.verifyEmail(dto)).resolves.toBeUndefined()
      expect(authService.verifyEmail).toHaveBeenCalledWith(dto)
    })
  })

  describe('resendVerification', () => {
    it('should call authService.resendVerification', async () => {
      const dto: ResendVerificationRequestDto = { email: 'user@example.com' }
      authService.resendVerification.mockResolvedValue(undefined)

      await expect(controller.resendVerification(dto)).resolves.toBeUndefined()
      expect(authService.resendVerification).toHaveBeenCalledWith(dto)
    })
  })

  describe('requestPasswordReset', () => {
    it('should call authService.requestPasswordReset', async () => {
      const dto: PasswordResetRequestDto = { email: 'user@example.com' }
      authService.requestPasswordReset.mockResolvedValue(undefined)

      await expect(controller.requestPasswordReset(dto)).resolves.toBeUndefined()
      expect(authService.requestPasswordReset).toHaveBeenCalledWith(dto)
    })
  })

  describe('verifyPasswordReset', () => {
    it('should call authService.verifyPasswordReset', async () => {
      const dto: VerifyPasswordResetRequestDto = {
        email: 'user@example.com',
        code: '123456',
        newPassword: 'NewPassword1!',
      }
      authService.verifyPasswordReset.mockResolvedValue(undefined)

      await expect(controller.verifyPasswordReset(dto)).resolves.toBeUndefined()
      expect(authService.verifyPasswordReset).toHaveBeenCalledWith(dto)
    })
  })

  describe('changePassword', () => {
    it('should call authService.changePassword with user id and dto', async () => {
      const dto: ChangePasswordRequestDto = {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword1!',
      }
      const userId = 'user-id'
      authService.changePassword.mockResolvedValue(undefined)

      await expect(controller.changePassword(userId, dto)).resolves.toBeUndefined()
      expect(authService.changePassword).toHaveBeenCalledWith(userId, dto)
    })
  })
})

function createAuthResponse(): AuthResponseDto {
  return {
    accessToken: 'token',
    user: {
      id: 'user-id',
      email: 'user@example.com',
      nickname: 'tester',
      emailVerified: false,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    },
  }
}
