import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface HttpRetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  retryOn?: (status: number) => boolean
}

export interface HttpRequestOptions {
  timeoutMs?: number
  headers?: Record<string, string>
  retry?: HttpRetryOptions
}

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name)

  constructor(private readonly config: ConfigService) {}

  async postJson<T>(url: string, body: unknown, options?: HttpRequestOptions): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? 10000
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': this.config.get<string>('http.userAgent', 'app-http-client/1.0'),
      ...(options?.headers || {}),
    }

    const retry: Required<HttpRetryOptions> = {
      maxRetries: options?.retry?.maxRetries ?? 3,
      baseDelayMs: options?.retry?.baseDelayMs ?? 300,
      retryOn:
        options?.retry?.retryOn ||
        ((status: number) => {
          return status >= 500 && status < 600
        }),
    }

    let attempt = 0
    while (true) {
      const controller = new AbortController()
      const to = setTimeout(() => controller.abort(), timeoutMs)
      const started = Date.now()
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        const duration = Date.now() - started

        if (!resp.ok) {
          const text = await resp.text().catch(() => '')
          const shouldRetry = retry.retryOn(resp.status)
          this.logger.warn(
            `HTTP POST ${url} -> ${resp.status} in ${duration}ms${shouldRetry ? ' (will retry)' : ''}`,
          )
          if (shouldRetry && attempt < retry.maxRetries) {
            attempt++
            const delay = retry.baseDelayMs * 2 ** (attempt - 1)
            await new Promise(r => setTimeout(r, delay))
            continue
          }
          throw new Error(`HTTP ${resp.status} ${resp.statusText} ${text}`)
        }
        this.logger.debug(`HTTP POST ${url} -> ${resp.status} in ${duration}ms`)
        return (await resp.json()) as T
      } catch (err) {
        const duration = Date.now() - started
        this.logger.warn(
          `HTTP POST ${url} network error in ${duration}ms: ${(err as Error).message}`,
        )
        if (attempt < retry.maxRetries) {
          attempt++
          const delay = retry.baseDelayMs * 2 ** (attempt - 1)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
        throw err
      } finally {
        clearTimeout(to)
      }
    }
  }

  async post<T>(
    url: string,
    body: string | URLSearchParams | Buffer,
    options?: HttpRequestOptions,
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? 10000
    const headers = {
      'User-Agent': this.config.get<string>('http.userAgent', 'app-http-client/1.0'),
      ...(options?.headers || {}),
    }

    const retry: Required<HttpRetryOptions> = {
      maxRetries: options?.retry?.maxRetries ?? 3,
      baseDelayMs: options?.retry?.baseDelayMs ?? 300,
      retryOn:
        options?.retry?.retryOn ||
        ((status: number) => {
          return status >= 500 && status < 600
        }),
    }

    let attempt = 0
    while (true) {
      const controller = new AbortController()
      const to = setTimeout(() => controller.abort(), timeoutMs)
      const started = Date.now()
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: body instanceof URLSearchParams ? body.toString() : (body as any),
          signal: controller.signal,
        })
        const duration = Date.now() - started

        if (!resp.ok) {
          const text = await resp.text().catch(() => '')
          const shouldRetry = retry.retryOn(resp.status)
          this.logger.warn(
            `HTTP POST ${url} -> ${resp.status} in ${duration}ms${shouldRetry ? ' (will retry)' : ''}`,
          )
          if (shouldRetry && attempt < retry.maxRetries) {
            attempt++
            const delay = retry.baseDelayMs * 2**(attempt - 1)
            await new Promise(r => setTimeout(r, delay))
            continue
          }
          throw new Error(`HTTP ${resp.status} ${resp.statusText} ${text}`)
        }
        this.logger.debug(`HTTP POST ${url} -> ${resp.status} in ${duration}ms`)
        return (await resp.json()) as T
      } catch (err) {
        const duration = Date.now() - started
        this.logger.warn(
          `HTTP POST ${url} network error in ${duration}ms: ${(err as Error).message}`,
        )
        if (attempt < retry.maxRetries) {
          attempt++
          const delay = retry.baseDelayMs * 2**(attempt - 1)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
        throw err
      } finally {
        clearTimeout(to)
      }
    }
  }
}
