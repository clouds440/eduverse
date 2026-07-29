-- One-time exception for the demo organization:
-- grant 500 free AI credits for the current UTC billing month.
INSERT INTO "AISubscription" (
  "id",
  "ownerType",
  "organizationId",
  "userId",
  "plan",
  "status",
  "monthlyCredits",
  "limitMode",
  "currentPeriodStart",
  "currentPeriodEnd",
  "createdAt",
  "updatedAt"
)
SELECT
  'demo-org-free-ai-subscription-20260729',
  'ORGANIZATION'::"AISubscriptionOwnerType",
  "Organization"."id",
  NULL,
  'FREE'::"AISubscriptionPlan",
  'ACTIVE'::"AISubscriptionStatus",
  500,
  'HARD'::"AILimitMode",
  date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 month',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization"
WHERE "Organization"."id" = '7645abff-d28a-4a53-a7cb-faba2d831faa'
ON CONFLICT ("ownerType", "organizationId") DO UPDATE SET
  "plan" = 'FREE'::"AISubscriptionPlan",
  "status" = 'ACTIVE'::"AISubscriptionStatus",
  "monthlyCredits" = 500,
  "limitMode" = 'HARD'::"AILimitMode",
  "currentPeriodStart" = EXCLUDED."currentPeriodStart",
  "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
  "updatedAt" = CURRENT_TIMESTAMP;
