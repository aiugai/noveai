export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ChatCompletionOptions {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ChatCompletionResult {
  content: string
}

export interface LlmProviderAdapter {
  sendChatCompletion: (options: ChatCompletionOptions) => Promise<ChatCompletionResult>
}

