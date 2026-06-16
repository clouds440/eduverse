-- AlterTable
ALTER TABLE "Building" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Building" ADD COLUMN "imageUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Room" ADD COLUMN "imageUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FinanceAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "claimId" TEXT,
    "transactionId" TEXT,
    "fileId" TEXT,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceAttachment_organizationId_idx" ON "FinanceAttachment"("organizationId");

-- CreateIndex
CREATE INDEX "FinanceAttachment_entryId_idx" ON "FinanceAttachment"("entryId");

-- CreateIndex
CREATE INDEX "FinanceAttachment_claimId_idx" ON "FinanceAttachment"("claimId");

-- CreateIndex
CREATE INDEX "FinanceAttachment_transactionId_idx" ON "FinanceAttachment"("transactionId");

-- CreateIndex
CREATE INDEX "FinanceAttachment_uploadedById_idx" ON "FinanceAttachment"("uploadedById");

-- AddForeignKey
ALTER TABLE "FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinancialEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "PaymentClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
