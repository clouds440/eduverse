ALTER TABLE "Cohort" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Cohort_isActive_idx" ON "Cohort"("isActive");
