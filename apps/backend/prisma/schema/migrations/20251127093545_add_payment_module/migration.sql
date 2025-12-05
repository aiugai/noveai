-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RechargePackageStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "guest_requires_binding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_guest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(30,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'PENDING',
    "external_order_id" TEXT,
    "target_asset_type_id" TEXT,
    "target_asset_amount" DECIMAL(30,6),
    "exchange_rate" DECIMAL(30,6),
    "payment_details" JSONB,
    "callback_data" JSONB,
    "expires_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_recharge_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_title" TEXT NOT NULL,
    "badge_label" TEXT NOT NULL,
    "price_amount" DECIMAL(10,2) NOT NULL,
    "price_currency" TEXT NOT NULL,
    "base_score" INTEGER NOT NULL,
    "bonus_percent" INTEGER NOT NULL,
    "total_score" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "RechargePackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_recharge_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_orders_user_id_idx" ON "payment_orders"("user_id");

-- CreateIndex
CREATE INDEX "payment_orders_status_idx" ON "payment_orders"("status");

-- CreateIndex
CREATE INDEX "payment_orders_external_order_id_idx" ON "payment_orders"("external_order_id");

-- CreateIndex
CREATE INDEX "payment_orders_created_at_idx" ON "payment_orders"("created_at");

-- CreateIndex
CREATE INDEX "payment_recharge_packages_status_sort_order_idx" ON "payment_recharge_packages"("status", "sort_order");

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_target_asset_type_id_fkey" FOREIGN KEY ("target_asset_type_id") REFERENCES "asset_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
