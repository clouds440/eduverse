ALTER TABLE "WebPushSubscription"
ADD COLUMN "deviceId" TEXT;

CREATE INDEX "WebPushSubscription_userId_deviceId_idx"
ON "WebPushSubscription"("userId", "deviceId");
