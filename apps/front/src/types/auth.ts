import { schemas } from '@ai/api-contracts'
import { z } from 'zod'

export type AuthResponse = z.infer<typeof schemas.AuthResponseDto>
export const authResponseSchema = schemas.AuthResponseDto

export type ProfileResponse = z.infer<typeof schemas.UserProfileResponseDto>
export const profileResponseSchema = schemas.UserProfileResponseDto
