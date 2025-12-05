-- AlterTable
ALTER TABLE "payment_recharge_packages" ALTER COLUMN "price_currency" SET DEFAULT 'USD',
ALTER COLUMN "bonus_percent" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "payment_recharge_packages_name_key" ON "payment_recharge_packages"("name");

-- CreateIndex
CREATE INDEX "payment_recharge_packages_price_amount_price_currency_statu_idx" ON "payment_recharge_packages"("price_amount", "price_currency", "status", "sort_order");
