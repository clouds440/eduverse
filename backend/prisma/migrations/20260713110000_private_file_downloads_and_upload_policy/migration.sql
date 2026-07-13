ALTER TABLE "File"
  ADD COLUMN "resourceType" TEXT NOT NULL DEFAULT 'raw',
  ADD COLUMN "deliveryType" TEXT NOT NULL DEFAULT 'upload',
  ADD COLUMN "fileKind" TEXT NOT NULL DEFAULT 'document',
  ADD COLUMN "extension" TEXT,
  ADD COLUMN "sha256" TEXT,
  ADD COLUMN "scanStatus" TEXT NOT NULL DEFAULT 'PASSED';

UPDATE "File"
SET
  "resourceType" = CASE
    WHEN "mimeType" LIKE 'image/%' AND "mimeType" <> 'image/svg+xml' THEN 'image'
    ELSE 'raw'
  END,
  "fileKind" = CASE
    WHEN "mimeType" LIKE 'image/%' AND "mimeType" <> 'image/svg+xml' THEN 'image'
    WHEN "mimeType" = 'application/zip' OR "mimeType" = 'application/x-zip-compressed' THEN 'archive'
    WHEN "mimeType" LIKE 'text/%' OR "mimeType" = 'application/json' OR "mimeType" = 'application/xml' OR "mimeType" = 'image/svg+xml' THEN 'source'
    ELSE 'document'
  END,
  "extension" = lower(substring("filename" from '\.[^.]+$'));

ALTER TABLE "File" ALTER COLUMN "deliveryType" SET DEFAULT 'authenticated';

UPDATE "FinanceAttachment"
SET "url" = '/files/' || "fileId" || '/download'
WHERE "fileId" IS NOT NULL;

CREATE INDEX "File_sha256_idx" ON "File"("sha256");
