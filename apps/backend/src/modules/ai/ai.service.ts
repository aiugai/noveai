import type { ChatCompletionResult, ChatMessage, LlmProviderAdapter } from './providers/llm-provider-adapter.interface'
import { Injectable } from '@nestjs/common'
 
import { ConfigService } from '@nestjs/config'

import { AiProviderErrorException } from './exceptions/ai-provider-error.exception'
import { AiProviderNotFoundException } from './exceptions/ai-provider-not-found.exception'
import { OpenAiCompatibleAdapter } from './providers/openai-compatible.adapter'

export interface AiChatOptions {
  providerCode?: string
  model?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
}

@Injectable()
export class AiService {
  // 当前系统默认仅配置 uniapi 作为 OpenAI 兼容提供商
  private static readonly DEFAULT_PROVIDER_CODE = 'uniapi'
  private static readonly DEFAULT_MODEL = 'gpt-4'

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async chat(options: AiChatOptions): Promise<ChatCompletionResult> {
    if (!options.messages?.length) {
      throw new AiProviderErrorException(
        options.providerCode ?? AiService.DEFAULT_PROVIDER_CODE,
        'EMPTY_MESSAGES',
        'Chat messages must not be empty',
      )
    }

    const providerCode = options.providerCode ?? AiService.DEFAULT_PROVIDER_CODE

    // 目前只支持 uniapi 提供商
    if (providerCode !== AiService.DEFAULT_PROVIDER_CODE) {
      throw new AiProviderNotFoundException(providerCode)
    }

    const aiConfig = this.configService.get('ai')
    const apiKey = aiConfig?.uniapi?.apiKey
    if (!apiKey) {
      throw new AiProviderErrorException(providerCode, 'NO_API_KEY', 'UNIAPI_API_KEY is not configured')
    }

    const baseUrl = aiConfig?.uniapi?.baseUrl || 'https://api.uniapi.io'

    const model = options.model ?? AiService.DEFAULT_MODEL

    const adapter: LlmProviderAdapter = new OpenAiCompatibleAdapter({
      baseUrl,
      apiKey,
      timeoutMs: 10_000,
    })
    try {
      return await adapter.sendChatCompletion({
        model,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      })
    }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new AiProviderErrorException(providerCode, 'PROVIDER_REQUEST_FAILED', detail)
    }
  }
}

