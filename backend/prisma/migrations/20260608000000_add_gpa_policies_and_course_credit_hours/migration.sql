CREATE TYPE "GpaCalculationMethod" AS ENUM ('SIMPLE_AVERAGE', 'WEIGHTED_BY_CREDIT_HOURS');

CREATE TYPE "GpaRounding" AS ENUM ('NONE', 'ONE_DECIMAL', 'TWO_DECIMALS');

ALTER TABLE "Course" ADD COLUMN "creditHours" DOUBLE PRECISION NOT NULL DEFAULT 3;

CREATE TABLE "GpaPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "method" "GpaCalculationMethod" NOT NULL DEFAULT 'WEIGHTED_BY_CREDIT_HOURS',
    "rounding" "GpaRounding" NOT NULL DEFAULT 'TWO_DECIMALS',
    "gradeRules" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GpaPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GpaPolicy_organizationId_idx" ON "GpaPolicy"("organizationId");
CREATE INDEX "GpaPolicy_isDefault_idx" ON "GpaPolicy"("isDefault");
CREATE UNIQUE INDEX "GpaPolicy_one_default_per_org_idx" ON "GpaPolicy"("organizationId") WHERE "isDefault" = true;

ALTER TABLE "GpaPolicy" ADD CONSTRAINT "GpaPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "GpaPolicy" (
    "id",
    "organizationId",
    "name",
    "scale",
    "method",
    "rounding",
    "gradeRules",
    "isDefault"
)
SELECT
    CONCAT('gpa-policy-', "id"),
    "id",
    'Standard 4.0',
    4.0,
    'WEIGHTED_BY_CREDIT_HOURS'::"GpaCalculationMethod",
    'TWO_DECIMALS'::"GpaRounding",
    '[
      { "min": 85, "max": 100, "letter": "A", "points": 4.0 },
      { "min": 80, "max": 84.99, "letter": "A-", "points": 3.7 },
      { "min": 75, "max": 79.99, "letter": "B+", "points": 3.3 },
      { "min": 70, "max": 74.99, "letter": "B", "points": 3.0 },
      { "min": 65, "max": 69.99, "letter": "B-", "points": 2.7 },
      { "min": 60, "max": 64.99, "letter": "C+", "points": 2.3 },
      { "min": 55, "max": 59.99, "letter": "C", "points": 2.0 },
      { "min": 50, "max": 54.99, "letter": "D", "points": 1.0 },
      { "min": 0, "max": 49.99, "letter": "F", "points": 0.0 }
    ]'::jsonb,
    true
FROM "Organization";
