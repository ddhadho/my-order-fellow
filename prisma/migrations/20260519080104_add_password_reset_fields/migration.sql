-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT;
