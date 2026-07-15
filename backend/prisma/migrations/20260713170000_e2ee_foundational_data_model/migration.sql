CREATE TYPE "E2EEContentType" AS ENUM ('CHAT_MESSAGE', 'MAIL_MESSAGE', 'MAIL_SUBJECT', 'FILE_ATTACHMENT');

CREATE TABLE "UserEncryptionIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "identityPublicKey" TEXT NOT NULL,
    "publicKeyFingerprint" TEXT,
    "signingPublicKey" TEXT,
    "signingPublicKeyFingerprint" TEXT,
    "algorithm" TEXT NOT NULL DEFAULT 'libsodium:x25519+ed25519',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "UserEncryptionIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrustedEncryptionDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "identityId" TEXT,
    "clientDeviceId" TEXT NOT NULL,
    "displayName" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "keyAgreementPublicKey" TEXT NOT NULL,
    "keyAgreementPublicKeyFingerprint" TEXT,
    "signingPublicKey" TEXT,
    "signingPublicKeyFingerprint" TEXT,
    "algorithm" TEXT NOT NULL DEFAULT 'libsodium:x25519+ed25519',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "trustedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "TrustedEncryptionDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EncryptedContent" (
    "id" TEXT NOT NULL,
    "contentType" "E2EEContentType" NOT NULL,
    "chatMessageId" TEXT,
    "mailMessageId" TEXT,
    "mailId" TEXT,
    "fileId" TEXT,
    "encryptionVersion" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "authTag" TEXT,
    "associatedData" JSONB,
    "contentKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncryptedContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "E2EEKeyEnvelope" (
    "id" TEXT NOT NULL,
    "encryptedContentId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "trustedDeviceId" TEXT NOT NULL,
    "senderDeviceId" TEXT,
    "deviceKeyVersion" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "nonce" TEXT,
    "associatedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "E2EEKeyEnvelope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserEncryptionIdentity_userId_key" ON "UserEncryptionIdentity"("userId");
CREATE INDEX "UserEncryptionIdentity_userId_keyVersion_idx" ON "UserEncryptionIdentity"("userId", "keyVersion");

CREATE UNIQUE INDEX "TrustedEncryptionDevice_userId_clientDeviceId_key" ON "TrustedEncryptionDevice"("userId", "clientDeviceId");
CREATE INDEX "TrustedEncryptionDevice_identityId_idx" ON "TrustedEncryptionDevice"("identityId");
CREATE INDEX "TrustedEncryptionDevice_userId_revokedAt_idx" ON "TrustedEncryptionDevice"("userId", "revokedAt");
CREATE INDEX "TrustedEncryptionDevice_clientDeviceId_idx" ON "TrustedEncryptionDevice"("clientDeviceId");
CREATE INDEX "TrustedEncryptionDevice_revokedById_idx" ON "TrustedEncryptionDevice"("revokedById");

CREATE UNIQUE INDEX "EncryptedContent_chatMessageId_key" ON "EncryptedContent"("chatMessageId");
CREATE UNIQUE INDEX "EncryptedContent_mailMessageId_key" ON "EncryptedContent"("mailMessageId");
CREATE UNIQUE INDEX "EncryptedContent_mailId_key" ON "EncryptedContent"("mailId");
CREATE UNIQUE INDEX "EncryptedContent_fileId_key" ON "EncryptedContent"("fileId");
CREATE INDEX "EncryptedContent_contentType_idx" ON "EncryptedContent"("contentType");
CREATE INDEX "EncryptedContent_chatMessageId_idx" ON "EncryptedContent"("chatMessageId");
CREATE INDEX "EncryptedContent_mailMessageId_idx" ON "EncryptedContent"("mailMessageId");
CREATE INDEX "EncryptedContent_mailId_idx" ON "EncryptedContent"("mailId");
CREATE INDEX "EncryptedContent_fileId_idx" ON "EncryptedContent"("fileId");
CREATE INDEX "EncryptedContent_encryptionVersion_idx" ON "EncryptedContent"("encryptionVersion");
CREATE INDEX "EncryptedContent_createdAt_idx" ON "EncryptedContent"("createdAt");

ALTER TABLE "EncryptedContent" ADD CONSTRAINT "EncryptedContent_source_matches_type_check" CHECK (
    ("contentType" = 'CHAT_MESSAGE' AND "chatMessageId" IS NOT NULL AND "mailMessageId" IS NULL AND "mailId" IS NULL AND "fileId" IS NULL)
    OR ("contentType" = 'MAIL_MESSAGE' AND "chatMessageId" IS NULL AND "mailMessageId" IS NOT NULL AND "mailId" IS NULL AND "fileId" IS NULL)
    OR ("contentType" = 'MAIL_SUBJECT' AND "chatMessageId" IS NULL AND "mailMessageId" IS NULL AND "mailId" IS NOT NULL AND "fileId" IS NULL)
    OR ("contentType" = 'FILE_ATTACHMENT' AND "chatMessageId" IS NULL AND "mailMessageId" IS NULL AND "mailId" IS NULL AND "fileId" IS NOT NULL)
);

CREATE UNIQUE INDEX "E2EEKeyEnvelope_encryptedContentId_trustedDeviceId_key" ON "E2EEKeyEnvelope"("encryptedContentId", "trustedDeviceId");
CREATE INDEX "E2EEKeyEnvelope_recipientUserId_idx" ON "E2EEKeyEnvelope"("recipientUserId");
CREATE INDEX "E2EEKeyEnvelope_trustedDeviceId_idx" ON "E2EEKeyEnvelope"("trustedDeviceId");
CREATE INDEX "E2EEKeyEnvelope_senderDeviceId_idx" ON "E2EEKeyEnvelope"("senderDeviceId");
CREATE INDEX "E2EEKeyEnvelope_createdAt_idx" ON "E2EEKeyEnvelope"("createdAt");

ALTER TABLE "UserEncryptionIdentity" ADD CONSTRAINT "UserEncryptionIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrustedEncryptionDevice" ADD CONSTRAINT "TrustedEncryptionDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustedEncryptionDevice" ADD CONSTRAINT "TrustedEncryptionDevice_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "UserEncryptionIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustedEncryptionDevice" ADD CONSTRAINT "TrustedEncryptionDevice_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EncryptedContent" ADD CONSTRAINT "EncryptedContent_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EncryptedContent" ADD CONSTRAINT "EncryptedContent_mailMessageId_fkey" FOREIGN KEY ("mailMessageId") REFERENCES "MailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EncryptedContent" ADD CONSTRAINT "EncryptedContent_mailId_fkey" FOREIGN KEY ("mailId") REFERENCES "Mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EncryptedContent" ADD CONSTRAINT "EncryptedContent_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "E2EEKeyEnvelope" ADD CONSTRAINT "E2EEKeyEnvelope_encryptedContentId_fkey" FOREIGN KEY ("encryptedContentId") REFERENCES "EncryptedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "E2EEKeyEnvelope" ADD CONSTRAINT "E2EEKeyEnvelope_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "E2EEKeyEnvelope" ADD CONSTRAINT "E2EEKeyEnvelope_trustedDeviceId_fkey" FOREIGN KEY ("trustedDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "E2EEKeyEnvelope" ADD CONSTRAINT "E2EEKeyEnvelope_senderDeviceId_fkey" FOREIGN KEY ("senderDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
