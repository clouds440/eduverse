CREATE TYPE "CommunicationChannel" AS ENUM ('DIRECT_MESSAGE');

CREATE TABLE "UserCommunicationBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    "channel" "CommunicationChannel" NOT NULL DEFAULT 'DIRECT_MESSAGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCommunicationBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCommunicationBlock_userId_targetUserId_channel_key" ON "UserCommunicationBlock"("userId", "targetUserId", "channel");
CREATE INDEX "UserCommunicationBlock_userId_idx" ON "UserCommunicationBlock"("userId");
CREATE INDEX "UserCommunicationBlock_targetUserId_idx" ON "UserCommunicationBlock"("targetUserId");
CREATE INDEX "UserCommunicationBlock_organizationId_idx" ON "UserCommunicationBlock"("organizationId");
CREATE INDEX "UserCommunicationBlock_channel_idx" ON "UserCommunicationBlock"("channel");

ALTER TABLE "UserCommunicationBlock" ADD CONSTRAINT "UserCommunicationBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCommunicationBlock" ADD CONSTRAINT "UserCommunicationBlock_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCommunicationBlock" ADD CONSTRAINT "UserCommunicationBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
