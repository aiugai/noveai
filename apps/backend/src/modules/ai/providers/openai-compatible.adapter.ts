import type {
  ChatCompletionOptions,
  ChatCompletionResult,
  LlmProviderAdapter,
} from './llm-provider-adapter.interface'
import { AiProviderErrorException } from '../exceptions/ai-provider-error.exception'

interface OpenAiCompatibleConfig {
  baseUrl: string
  apiKey: string
  timeoutMs?: number
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      role?: string
      content?: string
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

interface OpenAiErrorResponse {
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

export class OpenAiCompatibleAdapter implements LlmProviderAdapter {
  constructor(private readonly config: OpenAiCompatibleConfig) {}

  async sendChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (options.stream)
      throw new AiProviderErrorException('openai-compatible', 'Streaming not supported', 'Streaming chat completion is not supported yet')

    const url = this.buildUrl('chat/completions')
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
    const timeoutId
      = controller && this.config.timeoutMs
        ? setTimeout(() => controller.abort(), this.config.timeoutMs)
        : undefined

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stream: false,
        }),
        signal: controller?.signal,
      })

      const text = await response.text()
      const payload = text ? JSON.parse(text) as OpenAiChatCompletionResponse & OpenAiErrorResponse : {}

      if (!response.ok) {
        const message = payload.error?.message ?? `OpenAI compatible request failed with status ${response.status}`
        throw new AiProviderErrorException('openai-compatible', 'Request failed', message)
      }

      const content = payload.choices?.[0]?.message?.content ?? ''

      return { content }
    }
    finally {
      if (timeoutId)
        clearTimeout(timeoutId)
    }
  }

  private buildUrl(path: string): string {
    const base = this.config.baseUrl.endsWith('/') ? this.config.baseUrl : `${this.config.baseUrl}/`
    return new URL(path, base).toString()
  }
}

