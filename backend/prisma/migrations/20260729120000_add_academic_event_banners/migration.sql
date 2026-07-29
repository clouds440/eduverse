ALTER TABLE "Holiday"
ADD COLUMN "bannerUrl" TEXT,
ADD COLUMN "bannerFileId" TEXT,
ADD COLUMN "bannerFilename" TEXT,
ADD COLUMN "bannerMimeType" TEXT,
ADD COLUMN "bannerUpdatedAt" TIMESTAMP(3);

ALTER TABLE "Announcement"
ADD COLUMN "bannerUrl" TEXT,
ADD COLUMN "bannerFileId" TEXT,
ADD COLUMN "bannerFilename" TEXT,
ADD COLUMN "bannerMimeType" TEXT,
ADD COLUMN "bannerUpdatedAt" TIMESTAMP(3);
