-- CreateTable
CREATE TABLE "staff_api_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "ipAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 120,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_api_idempotency_keys" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_api_idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_api_tokens_tokenPrefix_idx" ON "staff_api_tokens"("tokenPrefix");

-- CreateIndex
CREATE INDEX "staff_api_tokens_userId_idx" ON "staff_api_tokens"("userId");

-- CreateIndex
CREATE INDEX "admin_api_idempotency_keys_tokenId_expiresAt_idx" ON "admin_api_idempotency_keys"("tokenId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "admin_api_idempotency_keys_tokenId_key_key" ON "admin_api_idempotency_keys"("tokenId", "key");

-- AddForeignKey
ALTER TABLE "staff_api_tokens" ADD CONSTRAINT "staff_api_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_api_idempotency_keys" ADD CONSTRAINT "admin_api_idempotency_keys_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "staff_api_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
