-- Add an explicit free AI subscription plan for monthly non-paid quotas.
ALTER TYPE "AISubscriptionPlan" ADD VALUE IF NOT EXISTS 'FREE';
