-- AlterTable
ALTER TABLE "payment_orders" ADD COLUMN     "business_order_id" TEXT,
ADD COLUMN     "callback_url" VARCHAR(500),
ADD COLUMN     "description" VARCHAR(1000),
ADD COLUMN     "external_user_id" TEXT,
ADD COLUMN     "merchant_id" TEXT,
ADD COLUMN     "return_url" VARCHAR(500),
ALTER COLUMN "user_id" DROP NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'USD';

-- CreateIndex
CREATE INDEX "payment_orders_status_created_at_idx" ON "payment_orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "payment_orders_merchant_id_idx" ON "payment_orders"("merchant_id");

-- CreateIndex
CREATE INDEX "payment_orders_merchant_id_business_order_id_idx" ON "payment_orders"("merchant_id", "business_order_id");
