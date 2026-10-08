-- Gateway checkouts used to stamp the same session id on every PENDING
-- payment of an invoice, and fulfilment then completed all of them with the
-- same reference. Before enforcing one payment per (invoice, session), detach
-- the reference from all but one row of each duplicate group (the completed /
-- oldest one keeps it). The detached reference is kept at the front of the
-- notes so gateway metadata at the end of the notes stays parseable.
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "invoiceId", "transactionId"
      ORDER BY ("status" = 'COMPLETED') DESC, "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "payments"
  WHERE "transactionId" IS NOT NULL
)
UPDATE "payments" AS p
SET
  "notes" = 'Mükerrer oturum referansı ayrıldı: ' || p."transactionId" || ' | ' || COALESCE(p."notes", ''),
  "transactionId" = NULL
FROM ranked
WHERE p."id" = ranked."id" AND ranked.rn > 1;

-- CreateIndex
CREATE INDEX "payments_transactionId_idx" ON "payments"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoiceId_transactionId_key" ON "payments"("invoiceId", "transactionId");
