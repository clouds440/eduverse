-- Move the AI billing schema from the original Stripe identifiers to
-- provider-neutral Lemon Squeezy identifiers without rewriting migration history.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AISubscription' AND column_name = 'stripeCustomerId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AISubscription' AND column_name = 'lemonSqueezyCustomerId'
  ) THEN
    ALTER TABLE "AISubscription" RENAME COLUMN "stripeCustomerId" TO "lemonSqueezyCustomerId";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AISubscription' AND column_name = 'lemonSqueezyCustomerId'
  ) THEN
    ALTER TABLE "AISubscription" ADD COLUMN "lemonSqueezyCustomerId" TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AISubscription' AND column_name = 'stripeSubscriptionId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AISubscription' AND column_name = 'lemonSqueezySubscriptionId'
  ) THEN
    ALTER TABLE "AISubscription" RENAME COLUMN "stripeSubscriptionId" TO "lemonSqueezySubscriptionId";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AISubscription' AND column_name = 'lemonSqueezySubscriptionId'
  ) THEN
    ALTER TABLE "AISubscription" ADD COLUMN "lemonSqueezySubscriptionId" TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AISubscription' AND column_name = 'stripePriceId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AISubscription' AND column_name = 'lemonSqueezyVariantId'
  ) THEN
    ALTER TABLE "AISubscription" RENAME COLUMN "stripePriceId" TO "lemonSqueezyVariantId";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AISubscription' AND column_name = 'lemonSqueezyVariantId'
  ) THEN
    ALTER TABLE "AISubscription" ADD COLUMN "lemonSqueezyVariantId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AISubscription' AND column_name = 'lemonSqueezyPortalUrl'
  ) THEN
    ALTER TABLE "AISubscription" ADD COLUMN "lemonSqueezyPortalUrl" TEXT;
  END IF;
END $$;

DROP INDEX IF EXISTS "AISubscription_stripeCustomerId_idx";
DROP INDEX IF EXISTS "AISubscription_stripeSubscriptionId_idx";

CREATE INDEX IF NOT EXISTS "AISubscription_lemonSqueezyCustomerId_idx" ON "AISubscription"("lemonSqueezyCustomerId");
CREATE INDEX IF NOT EXISTS "AISubscription_lemonSqueezySubscriptionId_idx" ON "AISubscription"("lemonSqueezySubscriptionId");
