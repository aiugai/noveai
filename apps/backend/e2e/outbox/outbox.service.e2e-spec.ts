import { Test, TestingModule } from '@nestjs/testing'

import { OutboxService } from 'src/modules/message-bus/outbox/outbox.service'
import { OutboxRepository } from 'src/modules/message-bus/outbox/outbox.repository'
import { PrismaService } from 'src/prisma/prisma.service'
import { MessageEnvelope } from 'src/modules/message-bus/message-bus.types'

describe('[TC-OUTBOX-001] OutboxService.record (e2e)', () => {
  let moduleRef: TestingModule
  let service: OutboxService
  let repoCreateMock: jest.Mock
  let prismaGetClientMock: jest.Mock

  beforeAll(async () => {
    repoCreateMock = jest.fn()
    prismaGetClientMock = jest.fn(() => ({ name: 'default-client' }))

    moduleRef = await Test.createTestingModule({
      providers: [
        OutboxService,
        { provide: OutboxRepository, useValue: { create: repoCreateMock } },
        { provide: PrismaService, useValue: { getClient: prismaGetClientMock } },
      ],
    }).compile()

    service = moduleRef.get(OutboxService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(() => {
    repoCreateMock.mockReset()
    prismaGetClientMock.mockClear()
  })

  it('[TC-OUTBOX-002] should use Prisma client by default and save all metadata', async () => {
    const envelope: MessageEnvelope<{ orderId: string }> = {
      topic: 'payment',
      type: 'payment.completed',
      data: { orderId: 'order-1' },
      meta: { correlationId: 'corr-1', timestamp: new Date().toISOString() },
    }
    const options = {
      dedupeKey: 'dedupe-key',
      partitionKey: 'region-cn',
      priority: 5,
      deliverAt: new Date('2025-01-01T00:00:00.000Z'),
    }
    const expectedRow = { id: 101, topic: envelope.topic }
    repoCreateMock.mockResolvedValue(expectedRow)

    const row = await service.record(envelope, options)

    expect(row).toBe(expectedRow)
    expect(prismaGetClientMock).toHaveBeenCalledTimes(1)
    expect(repoCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: envelope.topic,
        type: envelope.type,
        payload: envelope.data,
        dedupeKey: options.dedupeKey,
        correlationId: envelope.meta?.correlationId,
        partitionKey: options.partitionKey,
        priority: options.priority,
        deliverAt: options.deliverAt,
      }),
      prismaGetClientMock.mock.results[0].value,
    )
  })

  it('[TC-OUTBOX-003] should reuse transaction client when provided and allow correlationId override', async () => {
    const envelope: MessageEnvelope<{ userId: string }> = {
      topic: 'user',
      type: 'user.created',
      data: { userId: 'user-123' },
      meta: {},
    }
    const tx = { name: 'tx-client' } as any
    const options = { correlationId: 'corr-override', priority: 9 }
    const expectedRow = { id: 202, topic: envelope.topic }
    repoCreateMock.mockResolvedValue(expectedRow)

    const row = await service.record(envelope, options, tx)

    expect(row).toBe(expectedRow)
    expect(prismaGetClientMock).not.toHaveBeenCalled()
    expect(repoCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: envelope.topic,
        correlationId: options.correlationId,
        priority: options.priority,
      }),
      tx,
    )
  })
})
