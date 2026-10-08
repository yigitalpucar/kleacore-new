-- Faz 2.3: module-owned state on services (Proxmox provisioning progress,
-- encrypted initial credentials). Nullable, no backfill: safe on a live DB.
ALTER TABLE "services" ADD COLUMN "moduleData" JSONB;
