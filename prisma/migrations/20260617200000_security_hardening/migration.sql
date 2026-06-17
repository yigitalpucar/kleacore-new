CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "keyPrefix" TEXT;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "keyHash" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'key'
  ) THEN
    UPDATE "api_keys"
    SET
      "keyPrefix" = LEFT("key", 16),
      "keyHash" = encode(digest("key", 'sha256'), 'hex')
    WHERE "key" IS NOT NULL;

    DELETE FROM "api_keys" WHERE "keyPrefix" IS NULL OR "keyHash" IS NULL;

    ALTER TABLE "api_keys" DROP COLUMN "key";
  END IF;
END $$;

ALTER TABLE "api_keys" ALTER COLUMN "keyPrefix" SET NOT NULL;
ALTER TABLE "api_keys" ALTER COLUMN "keyHash" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "api_keys_keyPrefix_idx" ON "api_keys"("keyPrefix");

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);