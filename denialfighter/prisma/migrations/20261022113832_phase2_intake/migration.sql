-- CreateEnum
CREATE TYPE "ProcessingState" AS ENUM ('IDLE', 'PROCESSING', 'READY', 'UNSUPPORTED', 'FAILED');

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "processingState" "ProcessingState" NOT NULL DEFAULT 'IDLE',
ADD COLUMN     "unsupportedReason" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "status" "ProcessingState" NOT NULL DEFAULT 'PROCESSING';

-- AlterTable
ALTER TABLE "LoginToken" ADD COLUMN     "redirectTo" TEXT;

-- CreateIndex
CREATE INDEX "Lead_ipHash_createdAt_idx" ON "Lead"("ipHash", "createdAt");
