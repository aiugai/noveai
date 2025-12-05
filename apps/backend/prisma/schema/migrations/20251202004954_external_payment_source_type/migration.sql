/*
  Warnings:

  - A unique constraint covering the columns `[merchant_id,business_order_id]` on the table `payment_orders` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PaymentOrderSourceType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- DropIndex
DROP INDEX "payment_orders_merchant_id_business_order_id_idx";

-- AlterTable
ALTER TABLE "payment_orders" ADD COLUMN     "signature_data" JSONB,
ADD COLUMN     "source_type" "PaymentOrderSourceType" NOT NULL DEFAULT 'INTERNAL';

-- CreateIndex
CREATE INDEX "payment_orders_source_type_status_created_at_idx" ON "payment_orders"("source_type", "status", "created_at");

-- CreateIndex
CREATE INDEX "payment_orders_merchant_id_created_at_idx" ON "payment_orders"("merchant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_merchant_id_business_order_id_key" ON "payment_orders"("merchant_id", "business_order_id");
