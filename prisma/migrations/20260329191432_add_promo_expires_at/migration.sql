-- AlterTable
ALTER TABLE "users" ADD COLUMN     "promo_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_promo_expires_at_idx" ON "users"("promo_expires_at");
