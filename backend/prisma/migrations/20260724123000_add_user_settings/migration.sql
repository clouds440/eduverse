-- CreateEnum
CREATE TYPE "TwoFactorMethod" AS ENUM ('DEVICE', 'EMAIL', 'BOTH');

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorMethod" "TwoFactorMethod" NOT NULL DEFAULT 'DEVICE',
    "themeMode" "ThemeMode" NOT NULL DEFAULT 'SYSTEM',
    "loginNotificationEmail" BOOLEAN NOT NULL DEFAULT true,
    "loginNotificationPush" BOOLEAN NOT NULL DEFAULT true,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- Backfill every existing user and preserve their selected theme.
INSERT INTO "UserSettings" (
    "userId",
    "themeMode",
    "updatedAt"
)
SELECT
    "id",
    "themeMode",
    CURRENT_TIMESTAMP
FROM "User";

-- AddForeignKey
ALTER TABLE "UserSettings"
ADD CONSTRAINT "UserSettings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Theme preference is now owned exclusively by UserSettings.
ALTER TABLE "User" DROP COLUMN "themeMode";
