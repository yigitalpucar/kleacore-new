-- Provisioning jobs can now also carry a remote unsuspend (after a
-- non-payment suspension is paid). Existing rows keep the PROVISION default.
CREATE TYPE "ProvisioningJobKind" AS ENUM ('PROVISION', 'UNSUSPEND');

ALTER TABLE "provisioning_jobs" ADD COLUMN "kind" "ProvisioningJobKind" NOT NULL DEFAULT 'PROVISION';
