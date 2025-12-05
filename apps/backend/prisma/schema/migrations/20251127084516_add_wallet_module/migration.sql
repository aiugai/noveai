-- CreateEnum
CREATE TYPE "SystemWalletID" AS ENUM ('SYSTEM_AI_REVENUE', 'SYSTEM_GIFT_REVENUE', 'SYSTEM_MARKET_REVENUE', 'SYSTEM_MODEL_PROVIDER_COST', 'SYSTEM_COMMISSION', 'SYSTEM_MARKETING', 'SYSTEM_REFUND', 'SYSTEM_DEPOSIT', 'SYSTEM_WITHDRAW', 'SYSTEM_ESCROW_MARKET', 'SYSTEM_RISK_RESERVE', 'SYSTEM_RECYCLE', 'SYSTEM_FEE', 'SYSTEM_ACTIVITY');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('RECHARGE', 'WITHDRAW', 'TRANSFER', 'CONSUMPTION', 'REFUND', 'FREEZE', 'UNFREEZE', 'TIP', 'COMMISSION', 'REWARD', 'ADMIN_ADJUST', 'SYSTEM_FEE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "asset_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "precision" INTEGER NOT NULL DEFAULT 6,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_assets" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "asset_type_id" TEXT NOT NULL,
    "balance" DECIMAL(30,6) NOT NULL DEFAULT 0,
    "frozen_balance" DECIMAL(30,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "from_wallet_id" TEXT,
    "to_wallet_id" TEXT,
    "asset_type_id" TEXT NOT NULL,
    "amount" DECIMAL(30,6) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "reason" TEXT,
    "metadata" JSONB,
    "unique_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_wallet_snapshots" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "asset_type_id" TEXT NOT NULL,
    "balance" DECIMAL(30,6) NOT NULL,
    "frozen_balance" DECIMAL(30,6) NOT NULL DEFAULT 0,
    "snapshot_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_wallet_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_code_key" ON "asset_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_assets_wallet_id_asset_type_id_key" ON "wallet_assets"("wallet_id", "asset_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_unique_id_key" ON "wallet_transactions"("unique_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_from_wallet_id_idx" ON "wallet_transactions"("from_wallet_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_to_wallet_id_idx" ON "wallet_transactions"("to_wallet_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_asset_type_id_idx" ON "wallet_transactions"("asset_type_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_type_idx" ON "wallet_transactions"("type");

-- CreateIndex
CREATE INDEX "wallet_transactions_status_idx" ON "wallet_transactions"("status");

-- CreateIndex
CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions"("created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_idx" ON "wallet_transactions"("user_id");

-- CreateIndex
CREATE INDEX "system_wallet_snapshots_wallet_id_asset_type_id_snapshot_at_idx" ON "system_wallet_snapshots"("wallet_id", "asset_type_id", "snapshot_at");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_assets" ADD CONSTRAINT "wallet_assets_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_assets" ADD CONSTRAINT "wallet_assets_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_from_wallet_id_fkey" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_to_wallet_id_fkey" FOREIGN KEY ("to_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_wallet_snapshots" ADD CONSTRAINT "system_wallet_snapshots_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
