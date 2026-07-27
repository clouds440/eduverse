CREATE TYPE "E2EEHistoryProvisioningStatus" AS ENUM ('PENDING', 'READY');

ALTER TABLE "PendingLogin" ADD COLUMN "pendingDeviceId" TEXT;
ALTER TABLE "TrustedEncryptionDevice"
ADD COLUMN "historyProvisioningStatus" "E2EEHistoryProvisioningStatus" NOT NULL DEFAULT 'READY';

CREATE TABLE "ChatDeviceHistoryGrant" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trustedDeviceId" TEXT NOT NULL,
    "senderDeviceId" TEXT,
    "deviceKeyVersion" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "nonce" TEXT,
    "associatedData" JSONB,
    "provisionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatDeviceHistoryGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "E2EEContentDeviceGrantEnvelope" (
    "id" TEXT NOT NULL,
    "encryptedContentId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "nonce" TEXT,
    "associatedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "E2EEContentDeviceGrantEnvelope_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PendingLogin_pendingDeviceId_idx" ON "PendingLogin"("pendingDeviceId");
CREATE UNIQUE INDEX "ChatDeviceHistoryGrant_chatId_trustedDeviceId_key"
ON "ChatDeviceHistoryGrant"("chatId", "trustedDeviceId");
CREATE INDEX "ChatDeviceHistoryGrant_userId_idx" ON "ChatDeviceHistoryGrant"("userId");
CREATE INDEX "ChatDeviceHistoryGrant_trustedDeviceId_idx" ON "ChatDeviceHistoryGrant"("trustedDeviceId");
CREATE INDEX "ChatDeviceHistoryGrant_senderDeviceId_idx" ON "ChatDeviceHistoryGrant"("senderDeviceId");
CREATE UNIQUE INDEX "E2EEContentDeviceGrantEnvelope_encryptedContentId_grantId_key"
ON "E2EEContentDeviceGrantEnvelope"("encryptedContentId", "grantId");
CREATE INDEX "E2EEContentDeviceGrantEnvelope_grantId_idx"
ON "E2EEContentDeviceGrantEnvelope"("grantId");

ALTER TABLE "PendingLogin" ADD CONSTRAINT "PendingLogin_pendingDeviceId_fkey"
FOREIGN KEY ("pendingDeviceId") REFERENCES "TrustedEncryptionDevice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatDeviceHistoryGrant" ADD CONSTRAINT "ChatDeviceHistoryGrant_chatId_fkey"
FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatDeviceHistoryGrant" ADD CONSTRAINT "ChatDeviceHistoryGrant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatDeviceHistoryGrant" ADD CONSTRAINT "ChatDeviceHistoryGrant_trustedDeviceId_fkey"
FOREIGN KEY ("trustedDeviceId") REFERENCES "TrustedEncryptionDevice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatDeviceHistoryGrant" ADD CONSTRAINT "ChatDeviceHistoryGrant_senderDeviceId_fkey"
FOREIGN KEY ("senderDeviceId") REFERENCES "TrustedEncryptionDevice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "E2EEContentDeviceGrantEnvelope"
ADD CONSTRAINT "E2EEContentDeviceGrantEnvelope_encryptedContentId_fkey"
FOREIGN KEY ("encryptedContentId") REFERENCES "EncryptedContent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "E2EEContentDeviceGrantEnvelope"
ADD CONSTRAINT "E2EEContentDeviceGrantEnvelope_grantId_fkey"
FOREIGN KEY ("grantId") REFERENCES "ChatDeviceHistoryGrant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
