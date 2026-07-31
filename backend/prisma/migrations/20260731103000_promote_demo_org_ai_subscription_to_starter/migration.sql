-- Keep the demo organization's manually seeded 500-credit AI quota usable.
-- The FREE plan has a tiny role-level testing cap, so promote the seeded
-- demo subscription to the existing 500-credit paid tier.
UPDATE "AISubscription"
SET
  "plan" = 'STARTER'::"AISubscriptionPlan",
  "status" = 'ACTIVE'::"AISubscriptionStatus",
  "monthlyCredits" = 500,
  "limitMode" = 'HARD'::"AILimitMode",
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "ownerType" = 'ORGANIZATION'::"AISubscriptionOwnerType"
  AND "organizationId" = '7645abff-d28a-4a53-a7cb-faba2d831faa'
  AND "plan" = 'FREE'::"AISubscriptionPlan";
