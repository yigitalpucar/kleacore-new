-- Auth hardening: TOTP replay protection, single-use 2FA login nonce and
-- session revocation stamp. All columns are nullable or defaulted, so this is
-- safe on a live table with existing rows (existing JWTs map to version 0).
ALTER TABLE "users" ADD COLUMN "twoFactorLastUsedStep" INTEGER;
ALTER TABLE "users" ADD COLUMN "loginTokenNonceHash" TEXT;
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
