import { CacheModule } from '@nestjs/cache-manager'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { getQueueToken } from '@nestjs/bull'

import { MessageBusService } from 'src/modules/message-bus/message-bus.service'
import { CacheService } from 'src/cache/cache.service'
import { MESSAGE_BUS_QUEUE } from 'src/modules/message-bus/message-bus.types'

describe('[TC-BUS-001] MessageBusService (e2e)', () => {
  let moduleRef: TestingModule
  let service: MessageBusService
  let cacheService: CacheService
  let queueAddMock: jest.Mock

  beforeAll(async () => {
    queueAddMock = jest.fn()
    const queueMock = {
      add: queueAddMock,
    }
    const configServiceMock = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'messageBus.backoffDelayMs') return 10
        if (key === 'messageBus.defaultMode') return 'handshake'
        return defaultValue
      }),
    }

    moduleRef = await Test.createTestingModule({
      imports: [CacheModule.register()],
      providers: [
        MessageBusService,
        CacheService,
        { provide: ConfigService, useValue: configServiceMock },
        { provide: getQueueToken(MESSAGE_BUS_QUEUE), useValue: queueMock },
      ],
    }).compile()

    service = moduleRef.get(MessageBusService)
    cacheService = moduleRef.get(CacheService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(() => {
    queueAddMock.mockReset()
  })

  it('[TC-BUS-002] should enqueue message and return jobId', async () => {
    queueAddMock.mockResolvedValueOnce({ id: 'job-001' })
    const dto = { userId: 'user-123' }

    const jobId = await service.publish('user-topic', 'user.created', dto, {
      dedupeKey: 'uniq',
      priority: 5,
      attempts: 2,
      delayMs: 20,
    })

    expect(jobId).toBe('job-001')
    expect(queueAddMock).toHaveBeenCalledWith(
      'user-topic',
      expect.objectContaining({
        topic: 'user-topic',
        type: 'user.created',
        data: dto,
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      }),
      expect.objectContaining({
        jobId: 'user-topic:uniq',
        priority: 5,
        attempts: 2,
        delay: 20,
        backoff: { type: 'exponential', delay: 10 },
      }),
    )
  })

  it('[TC-BUS-003] should return result after handshake completion', async () => {
    queueAddMock.mockResolvedValueOnce({ id: 'job-002' })
    const correlationId = 'cid-123456'
    const expectedResult = { status: 'ok', processedAt: new Date().toISOString() }
    const handshakeKey = service.buildHandshakeKey(correlationId)

    const markDonePromise = new Promise<void>(resolve => {
      setTimeout(async () => {
        await service.markDone(correlationId, expectedResult, 5)
        resolve()
      }, 30)
    })

    const resultPromise = service.publishAndWait(
      'handshake-topic',
      'process.completed',
      { value: 42 },
      { correlationId, timeoutMs: 1000, pollIntervalMs: 10 },
    )

    await markDonePromise
    const { jobId, result, correlationId: returnedCorrelationId } = await resultPromise

    expect(jobId).toBe('job-002')
    expect(returnedCorrelationId).toBe(correlationId)
    expect(result).toEqual(expectedResult)
    expect(await cacheService.get(handshakeKey)).toEqual(expectedResult)
  })
})
