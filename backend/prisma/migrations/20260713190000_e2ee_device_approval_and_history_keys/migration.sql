CREATE TYPE "E2EEDeviceTrustStatus" AS ENUM ('PENDING', 'TRUSTED', 'REVOKED');
CREATE TYPE "E2EEApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "E2EEHistoryKeyScope" AS ENUM ('CHAT_USER');

ALTER TABLE "TrustedEncryptionDevice"
  ADD COLUMN "trustStatus" "E2EEDeviceTrustStatus" NOT NULL DEFAULT 'TRUSTED',
  ADD COLUMN "approvalRequestedAt" TIMESTAMP(3),
  ADD COLUMN "approvedByDeviceId" TEXT;

ALTER TABLE "TrustedEncryptionDevice" ALTER COLUMN "trustedAt" DROP NOT NULL;

UPDATE "TrustedEncryptionDevice"
SET "trustStatus" = 'REVOKED'
WHERE "revokedAt" IS NOT NULL;

CREATE TABLE "E2EEDeviceApprovalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pendingDeviceId" TEXT NOT NULL,
    "approverDeviceId" TEXT,
    "status" "E2EEApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "E2EEDeviceApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatHistoryKey" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "E2EEHistoryKeyScope" NOT NULL DEFAULT 'CHAT_USER',
    "epoch" INTEGER NOT NULL DEFAULT 1,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "algorithm" TEXT NOT NULL DEFAULT 'libsodium:xchacha20poly1305-ietf',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ChatHistoryKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "E2EEHistoryKeyDeviceEnvelope" (
    "id" TEXT NOT NULL,
    "historyKeyId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "trustedDeviceId" TEXT NOT NULL,
    "senderDeviceId" TEXT,
    "deviceKeyVersion" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "nonce" TEXT,
    "associatedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "E2EEHistoryKeyDeviceEnvelope_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "E2EEContentHistoryKeyEnvelope" (
    "id" TEXT NOT NULL,
    "encryptedContentId" TEXT NOT NULL,
    "historyKeyId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "nonce" TEXT,
    "associatedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "E2EEContentHistoryKeyEnvelope_pkey" PRIMARY KEY ("id")
);

DROP INDEX IF EXISTS "TrustedEncryptionDevice_userId_revokedAt_idx";
CREATE INDEX "TrustedEncryptionDevice_userId_trustStatus_revokedAt_idx" ON "TrustedEncryptionDevice"("userId", "trustStatus", "revokedAt");
CREATE INDEX "TrustedEncryptionDevice_approvedByDeviceId_idx" ON "TrustedEncryptionDevice"("approvedByDeviceId");

CREATE INDEX "E2EEDeviceApprovalRequest_userId_status_idx" ON "E2EEDeviceApprovalRequest"("userId", "status");
CREATE INDEX "E2EEDeviceApprovalRequest_pendingDeviceId_status_idx" ON "E2EEDeviceApprovalRequest"("pendingDeviceId", "status");
CREATE INDEX "E2EEDeviceApprovalRequest_approverDeviceId_idx" ON "E2EEDeviceApprovalRequest"("approverDeviceId");
CREATE INDEX "E2EEDeviceApprovalRequest_requestedAt_idx" ON "E2EEDeviceApprovalRequest"("requestedAt");

CREATE UNIQUE INDEX "ChatHistoryKey_chatId_userId_epoch_key" ON "ChatHistoryKey"("chatId", "userId", "epoch");
CREATE INDEX "ChatHistoryKey_chatId_epoch_idx" ON "ChatHistoryKey"("chatId", "epoch");
CREATE INDEX "ChatHistoryKey_userId_idx" ON "ChatHistoryKey"("userId");
CREATE INDEX "ChatHistoryKey_scope_idx" ON "ChatHistoryKey"("scope");
CREATE INDEX "ChatHistoryKey_revokedAt_idx" ON "ChatHistoryKey"("revokedAt");

CREATE UNIQUE INDEX "E2EEHistoryKeyDeviceEnvelope_historyKeyId_trustedDeviceId_key" ON "E2EEHistoryKeyDeviceEnvelope"("historyKeyId", "trustedDeviceId");
CREATE INDEX "E2EEHistoryKeyDeviceEnvelope_recipientUserId_idx" ON "E2EEHistoryKeyDeviceEnvelope"("recipientUserId");
CREATE INDEX "E2EEHistoryKeyDeviceEnvelope_trustedDeviceId_idx" ON "E2EEHistoryKeyDeviceEnvelope"("trustedDeviceId");
CREATE INDEX "E2EEHistoryKeyDeviceEnvelope_senderDeviceId_idx" ON "E2EEHistoryKeyDeviceEnvelope"("senderDeviceId");
CREATE INDEX "E2EEHistoryKeyDeviceEnvelope_createdAt_idx" ON "E2EEHistoryKeyDeviceEnvelope"("createdAt");

CREATE UNIQUE INDEX "E2EEContentHistoryKeyEnvelope_encryptedContentId_historyKeyId_key" ON "E2EEContentHistoryKeyEnvelope"("encryptedContentId", "historyKeyId");
CREATE INDEX "E2EEContentHistoryKeyEnvelope_historyKeyId_idx" ON "E2EEContentHistoryKeyEnvelope"("historyKeyId");
CREATE INDEX "E2EEContentHistoryKeyEnvelope_recipientUserId_idx" ON "E2EEContentHistoryKeyEnvelope"("recipientUserId");
CREATE INDEX "E2EEContentHistoryKeyEnvelope_createdAt_idx" ON "E2EEContentHistoryKeyEnvelope"("createdAt");

ALTER TABLE "TrustedEncryptionDevice" ADD CONSTRAINT "TrustedEncryptionDevice_approvedByDeviceId_fkey" FOREIGN KEY ("approvedByDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "E2EEDeviceApprovalRequest" ADD CONSTRAINT "E2EEDeviceApprovalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "E2EEDeviceApprovalRequest" ADD CONSTRAINT "E2EEDeviceApprovalRequest_pendingDeviceId_fkey" FOREIGN KEY ("pendingDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "E2EEDeviceApprovalRequest" ADD CONSTRAINT "E2EEDeviceApprovalRequest_approverDeviceId_fkey" FOREIGN KEY ("approverDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChatHistoryKey" ADD CONSTRAINT "ChatHistoryKey_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatHistoryKey" ADD CONSTRAINT "ChatHistoryKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "E2EEHistoryKeyDeviceEnvelope" ADD CONSTRAINT "E2EEHistoryKeyDeviceEnvelope_historyKeyId_fkey" FOREIGN KEY ("historyKeyId") REFERENCES "ChatHistoryKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "E2EEHistoryKeyDeviceEnvelope" ADD CONSTRAINT "E2EEHistoryKeyDeviceEnvelope_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "E2EEHistoryKeyDeviceEnvelope" ADD CONSTRAINT "E2EEHistoryKeyDeviceEnvelope_trustedDeviceId_fkey" FOREIGN KEY ("trustedDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "E2EEHistoryKeyDeviceEnvelope" ADD CONSTRAINT "E2EEHistoryKeyDeviceEnvelope_senderDeviceId_fkey" FOREIGN KEY ("senderDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "E2EEContentHistoryKeyEnvelope" ADD CONSTRAINT "E2EEContentHistoryKeyEnvelope_encryptedContentId_fkey" FOREIGN KEY ("encryptedContentId") REFERENCES "EncryptedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "E2EEContentHistoryKeyEnvelope" ADD CONSTRAINT "E2EEContentHistoryKeyEnvelope_historyKeyId_fkey" FOREIGN KEY ("historyKeyId") REFERENCES "ChatHistoryKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "E2EEContentHistoryKeyEnvelope" ADD CONSTRAINT "E2EEContentHistoryKeyEnvelope_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
