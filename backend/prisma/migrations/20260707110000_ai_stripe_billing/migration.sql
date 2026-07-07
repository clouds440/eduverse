-- AlterTable
ALTER TABLE "AISubscription"
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "stripePriceId" TEXT;

-- CreateIndex
CREATE INDEX "AISubscription_stripeCustomerId_idx" ON "AISubscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "AISubscription_stripeSubscriptionId_idx" ON "AISubscription"("stripeSubscriptionId");
