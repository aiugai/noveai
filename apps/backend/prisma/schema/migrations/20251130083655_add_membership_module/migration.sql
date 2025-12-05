-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('SMALL', 'BIG');

-- CreateTable
CREATE TABLE "user_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tier" "MembershipTier" NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "source_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_memberships_user_id_end_at_idx" ON "user_memberships"("user_id", "end_at");

-- CreateIndex
CREATE INDEX "user_memberships_source_order_id_idx" ON "user_memberships"("source_order_id");

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_source_order_id_fkey" FOREIGN KEY ("source_order_id") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
