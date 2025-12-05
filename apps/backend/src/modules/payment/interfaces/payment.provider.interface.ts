import { PaymentOrder } from '@prisma/client'

export interface IPaymentResult {
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  externalOrderId?: string
  paymentDetails?: any
  error?: string
}

export interface IPaymentProvider {
  readonly channel: string

  /**
   * Initiates a payment order with the provider.
   */
  createPayment: (order: PaymentOrder) => Promise<IPaymentResult>

  /**
   * Handles incoming callbacks/webhooks from the provider.
   * Returns the updated PaymentOrder data or null if not applicable.
   */
  handleCallback: (payload: Record<string, unknown>) => Promise<Partial<PaymentOrder> | null>
}
