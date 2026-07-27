ALTER TABLE "UserSettings"
ADD COLUMN "emailTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deviceTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "PendingLoginStatus" AS ENUM ('PENDING', 'VERIFIED', 'CONSUMED', 'CANCELLED');

CREATE TABLE "PendingLogin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PendingLoginStatus" NOT NULL DEFAULT 'PENDING',
    "selectedMethod" "TwoFactorMethod",
    "availableMethods" "TwoFactorMethod"[],
    "emailCodeHash" TEXT,
    "emailCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailCodeSentAt" TIMESTAMP(3),
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "ip" TEXT,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PendingLogin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PendingLogin_userId_status_idx" ON "PendingLogin"("userId", "status");
CREATE INDEX "PendingLogin_expiresAt_idx" ON "PendingLogin"("expiresAt");
ALTER TABLE "PendingLogin" ADD CONSTRAINT "PendingLogin_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
