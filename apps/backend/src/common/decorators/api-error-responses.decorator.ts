import { applyDecorators } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger'
import { ErrorResponseDto } from '../dto/error.response.dto'

export const ApiErrorResponses = () =>
  applyDecorators(
    ApiBadRequestResponse({ type: ErrorResponseDto }),
    ApiUnauthorizedResponse({ type: ErrorResponseDto }),
    ApiForbiddenResponse({ type: ErrorResponseDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto }),
    ApiTooManyRequestsResponse({ type: ErrorResponseDto }),
    ApiUnprocessableEntityResponse({ type: ErrorResponseDto }),
    ApiInternalServerErrorResponse({ type: ErrorResponseDto }),
  )
