-- DropForeignKey
ALTER TABLE "AlertState" DROP CONSTRAINT "AlertState_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "AlertSubscription" DROP CONSTRAINT "AlertSubscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "BloodlineFollow" DROP CONSTRAINT "BloodlineFollow_userId_fkey";

-- DropForeignKey
ALTER TABLE "BreederProgramMembership" DROP CONSTRAINT "BreederProgramMembership_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserBadge" DROP CONSTRAINT "UserBadge_seasonId_fkey";

-- DropForeignKey
ALTER TABLE "UserBadge" DROP CONSTRAINT "UserBadge_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserMissionProgress" DROP CONSTRAINT "UserMissionProgress_seasonId_fkey";

-- DropForeignKey
ALTER TABLE "UserMissionProgress" DROP CONSTRAINT "UserMissionProgress_userId_fkey";

-- AlterTable
ALTER TABLE "AlertState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AlertSubscription" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BloodlineCard" ALTER COLUMN "visualStyle" SET NOT NULL;

-- AlterTable
ALTER TABLE "BreederProgramMembership" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MissionTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Season" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserMissionProgress" ALTER COLUMN "updatedAt" DROP DEFAULT;
