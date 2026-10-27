ALTER TYPE "TrialStatus" ADD VALUE 'AWAITING_PHONE' BEFORE 'PENDING';

ALTER TABLE "TrialRequest" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "TrialRequest" ADD COLUMN "handle" TEXT,
  ADD COLUMN "localId" TEXT,
  ADD COLUMN "fingerprint" TEXT,
  ADD COLUMN "ipInfo" JSONB,
  ADD COLUMN "code" TEXT,
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "risk" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reasons" JSONB,
  ADD COLUMN "auto" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "TrialRequest_handle_key" ON "TrialRequest"("handle");
CREATE UNIQUE INDEX "TrialRequest_code_key" ON "TrialRequest"("code");
CREATE INDEX "TrialRequest_localId_idx" ON "TrialRequest"("localId");
CREATE INDEX "TrialRequest_fingerprint_idx" ON "TrialRequest"("fingerprint");
