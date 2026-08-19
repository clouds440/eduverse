CREATE TABLE "ProgramOfferingFee" (
    "id" TEXT NOT NULL,
    "programOfferingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(65,30),
    "currencyCode" TEXT NOT NULL,
    "frequency" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isApplicationFee" BOOLEAN NOT NULL DEFAULT false,
    "refundable" BOOLEAN,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramOfferingFee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramOfferingFundingOption" (
    "id" TEXT NOT NULL,
    "programOfferingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fundingType" TEXT,
    "amountSummary" TEXT,
    "eligibilitySummary" TEXT,
    "applicationUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramOfferingFundingOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramAdmissionRequirement" (
    "id" TEXT NOT NULL,
    "programOfferingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "requirementType" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramAdmissionRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramOfferingPublication" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "programOfferingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramOfferingPublication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgramOfferingFee_programOfferingId_sortOrder_idx" ON "ProgramOfferingFee"("programOfferingId", "sortOrder");
CREATE INDEX "ProgramOfferingFundingOption_programOfferingId_sortOrder_idx" ON "ProgramOfferingFundingOption"("programOfferingId", "sortOrder");
CREATE INDEX "ProgramAdmissionRequirement_programOfferingId_sortOrder_idx" ON "ProgramAdmissionRequirement"("programOfferingId", "sortOrder");
CREATE UNIQUE INDEX "ProgramOfferingPublication_programOfferingId_version_key" ON "ProgramOfferingPublication"("programOfferingId", "version");
CREATE INDEX "ProgramOfferingPublication_providerId_publishedAt_idx" ON "ProgramOfferingPublication"("providerId", "publishedAt");
CREATE INDEX "ProgramOfferingPublication_programOfferingId_publishedAt_idx" ON "ProgramOfferingPublication"("programOfferingId", "publishedAt");

ALTER TABLE "ProgramOfferingFee" ADD CONSTRAINT "ProgramOfferingFee_programOfferingId_fkey" FOREIGN KEY ("programOfferingId") REFERENCES "ProgramOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramOfferingFundingOption" ADD CONSTRAINT "ProgramOfferingFundingOption_programOfferingId_fkey" FOREIGN KEY ("programOfferingId") REFERENCES "ProgramOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramAdmissionRequirement" ADD CONSTRAINT "ProgramAdmissionRequirement_programOfferingId_fkey" FOREIGN KEY ("programOfferingId") REFERENCES "ProgramOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramOfferingPublication" ADD CONSTRAINT "ProgramOfferingPublication_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgramOfferingPublication" ADD CONSTRAINT "ProgramOfferingPublication_programOfferingId_fkey" FOREIGN KEY ("programOfferingId") REFERENCES "ProgramOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
