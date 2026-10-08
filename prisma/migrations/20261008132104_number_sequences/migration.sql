-- Gap-tolerant counters for invoice / order numbers (one row per prefix+year).
-- Rows are created lazily by the application, seeded from the highest existing
-- number of that prefix+year, so existing invoices/orders never collide.
CREATE TABLE "number_sequences" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("key")
);
