-- AlterTable
ALTER TABLE "TrustedEncryptionDevice" ALTER COLUMN "trustedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "E2EEContentHistoryKeyEnvelope_encryptedContentId_historyKeyId_k" RENAME TO "E2EEContentHistoryKeyEnvelope_encryptedContentId_historyKey_key";
