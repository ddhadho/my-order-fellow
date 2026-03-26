-- CreateTable
CREATE TABLE "KycAuditLog" (
    "id" TEXT NOT NULL,
    "kycId" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycAuditLog_kycId_idx" ON "KycAuditLog"("kycId");

-- AddForeignKey
ALTER TABLE "KycAuditLog" ADD CONSTRAINT "KycAuditLog_kycId_fkey" FOREIGN KEY ("kycId") REFERENCES "KycInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
