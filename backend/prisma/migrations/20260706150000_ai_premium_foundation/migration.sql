-- CreateEnum
CREATE TYPE "AISubscriptionPlan" AS ENUM ('NONE', 'STARTER', 'GROWTH', 'SCALE');

-- CreateEnum
CREATE TYPE "AISubscriptionOwnerType" AS ENUM ('ORGANIZATION', 'USER');

-- CreateEnum
CREATE TYPE "AISubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'CANCELED', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "AILimitMode" AS ENUM ('HARD', 'SOFT');

-- CreateEnum
CREATE TYPE "AIUsageSourceType" AS ENUM ('ORGANIZATION', 'PERSONAL');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateTable
CREATE TABLE "AISubscription" (
    "id" TEXT NOT NULL,
    "ownerType" "AISubscriptionOwnerType" NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "plan" "AISubscriptionPlan" NOT NULL DEFAULT 'NONE',
    "status" "AISubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "monthlyCredits" INTEGER NOT NULL DEFAULT 0,
    "limitMode" "AILimitMode" NOT NULL DEFAULT 'HARD',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AISubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIOrgAccessPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "allowSubAdmins" BOOLEAN NOT NULL DEFAULT false,
    "allowManagers" BOOLEAN NOT NULL DEFAULT false,
    "allowFinanceManagers" BOOLEAN NOT NULL DEFAULT false,
    "allowTeachers" BOOLEAN NOT NULL DEFAULT false,
    "allowStudents" BOOLEAN NOT NULL DEFAULT false,
    "allowGuardians" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIOrgAccessPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRoleCreditPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "monthlyCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIRoleCreditPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "sourceType" "AIUsageSourceType" NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT NOT NULL,
    "role" "Role",
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "creditUsed" INTEGER NOT NULL DEFAULT 0,
    "providerTokenEstimate" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    "overageCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIToolCallLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "subscriptionId" TEXT,
    "sourceType" "AIUsageSourceType",
    "toolName" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "creditEstimate" INTEGER,
    "providerTokenEstimate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIToolCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "subscriptionId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AISubscription_ownerType_organizationId_key" ON "AISubscription"("ownerType", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AISubscription_ownerType_userId_key" ON "AISubscription"("ownerType", "userId");

-- CreateIndex
CREATE INDEX "AISubscription_ownerType_idx" ON "AISubscription"("ownerType");

-- CreateIndex
CREATE INDEX "AISubscription_plan_idx" ON "AISubscription"("plan");

-- CreateIndex
CREATE INDEX "AISubscription_status_idx" ON "AISubscription"("status");

-- CreateIndex
CREATE INDEX "AISubscription_organizationId_idx" ON "AISubscription"("organizationId");

-- CreateIndex
CREATE INDEX "AISubscription_userId_idx" ON "AISubscription"("userId");

-- CreateIndex
CREATE INDEX "AISubscription_currentPeriodEnd_idx" ON "AISubscription"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "AIOrgAccessPolicy_organizationId_key" ON "AIOrgAccessPolicy"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AIRoleCreditPolicy_organizationId_role_key" ON "AIRoleCreditPolicy"("organizationId", "role");

-- CreateIndex
CREATE INDEX "AIRoleCreditPolicy_organizationId_idx" ON "AIRoleCreditPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "AIRoleCreditPolicy_role_idx" ON "AIRoleCreditPolicy"("role");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsage_subscriptionId_userId_periodStart_key" ON "AIUsage"("subscriptionId", "userId", "periodStart");

-- CreateIndex
CREATE INDEX "AIUsage_subscriptionId_idx" ON "AIUsage"("subscriptionId");

-- CreateIndex
CREATE INDEX "AIUsage_sourceType_idx" ON "AIUsage"("sourceType");

-- CreateIndex
CREATE INDEX "AIUsage_organizationId_idx" ON "AIUsage"("organizationId");

-- CreateIndex
CREATE INDEX "AIUsage_userId_idx" ON "AIUsage"("userId");

-- CreateIndex
CREATE INDEX "AIUsage_role_idx" ON "AIUsage"("role");

-- CreateIndex
CREATE INDEX "AIUsage_periodStart_idx" ON "AIUsage"("periodStart");

-- CreateIndex
CREATE INDEX "AIUsage_periodEnd_idx" ON "AIUsage"("periodEnd");

-- CreateIndex
CREATE INDEX "AIToolCallLog_userId_idx" ON "AIToolCallLog"("userId");

-- CreateIndex
CREATE INDEX "AIToolCallLog_orgId_idx" ON "AIToolCallLog"("orgId");

-- CreateIndex
CREATE INDEX "AIToolCallLog_subscriptionId_idx" ON "AIToolCallLog"("subscriptionId");

-- CreateIndex
CREATE INDEX "AIToolCallLog_sourceType_idx" ON "AIToolCallLog"("sourceType");

-- CreateIndex
CREATE INDEX "AIToolCallLog_toolName_idx" ON "AIToolCallLog"("toolName");

-- CreateIndex
CREATE INDEX "AIToolCallLog_allowed_idx" ON "AIToolCallLog"("allowed");

-- CreateIndex
CREATE INDEX "AIToolCallLog_createdAt_idx" ON "AIToolCallLog"("createdAt");

-- CreateIndex
CREATE INDEX "AIConversation_userId_idx" ON "AIConversation"("userId");

-- CreateIndex
CREATE INDEX "AIConversation_organizationId_idx" ON "AIConversation"("organizationId");

-- CreateIndex
CREATE INDEX "AIConversation_subscriptionId_idx" ON "AIConversation"("subscriptionId");

-- CreateIndex
CREATE INDEX "AIConversation_expiresAt_idx" ON "AIConversation"("expiresAt");

-- CreateIndex
CREATE INDEX "AIConversation_updatedAt_idx" ON "AIConversation"("updatedAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_idx" ON "AIMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AIMessage_role_idx" ON "AIMessage"("role");

-- CreateIndex
CREATE INDEX "AIMessage_createdAt_idx" ON "AIMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "AISubscription" ADD CONSTRAINT "AISubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISubscription" ADD CONSTRAINT "AISubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIOrgAccessPolicy" ADD CONSTRAINT "AIOrgAccessPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRoleCreditPolicy" ADD CONSTRAINT "AIRoleCreditPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AISubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIToolCallLog" ADD CONSTRAINT "AIToolCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIToolCallLog" ADD CONSTRAINT "AIToolCallLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIToolCallLog" ADD CONSTRAINT "AIToolCallLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AISubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AISubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
