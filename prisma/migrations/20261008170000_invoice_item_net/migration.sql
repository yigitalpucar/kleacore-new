-- AlterEnum
ALTER TYPE "ProvisioningJobKind" ADD VALUE 'PLAN_CHANGE';

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Data migration: InvoiceItem.totalPrice becomes the NET (KDV-exclusive) line
-- total = unitPrice × quantity − discountAmount, so Σ lines = invoice.subtotal.
--
-- Checkout, domain transfer, renewal cron, service renewal and plan change
-- stored the KDV-inclusive total in totalPrice (renewal/plan change also in
-- unitPrice). Those invoices are recognised by Σ totalPrice = totalAmount ≠
-- subtotal and converted with the invoice's own tax rate:
--   net         = round_half_up(gross × 100 / (100 + taxRate), 2)
--   unitPrice   = net / quantity          when unitPrice held the gross too
--   discount    = unitPrice × qty − net   when unitPrice was already net
-- An invoice is rewritten only if, after conversion, Σ net = subtotal and
-- subtotal + taxAmount = totalAmount to the kuruş, every discount is ≥ 0 and a
-- gross unit price divides back exactly. Anything else is left untouched and
-- listed by scripts/sql/invoice-item-net-check.sql for manual review.
-- Idempotent: converted invoices satisfy Σ totalPrice = subtotal and are not
-- matched again.
WITH inv AS (
  SELECT i.id, i.subtotal, i."taxRate", i."taxAmount", i."totalAmount",
         SUM(it."totalPrice") AS lines_sum
  FROM "invoices" i
  JOIN "invoice_items" it ON it."invoiceId" = i.id
  GROUP BY i.id
),
gross AS (
  SELECT * FROM inv
  WHERE lines_sum = "totalAmount" AND lines_sum <> subtotal AND "taxRate" >= 0
),
calc AS (
  SELECT it.id,
         it."invoiceId",
         it.quantity,
         (it."unitPrice" * it.quantity = it."totalPrice") AS unit_was_gross,
         ROUND(it."totalPrice" * 100 / (100 + g."taxRate"), 2) AS net_total,
         it."unitPrice"
  FROM "invoice_items" it
  JOIN gross g ON g.id = it."invoiceId"
),
converted AS (
  SELECT c.id,
         c."invoiceId",
         c.net_total,
         CASE WHEN c.unit_was_gross THEN ROUND(c.net_total / c.quantity, 2) ELSE c."unitPrice" END AS new_unit,
         CASE WHEN c.unit_was_gross THEN 0 ELSE c."unitPrice" * c.quantity - c.net_total END AS new_discount,
         CASE
           WHEN c.unit_was_gross THEN ROUND(c.net_total / c.quantity, 2) * c.quantity = c.net_total
           ELSE c."unitPrice" * c.quantity - c.net_total >= 0
         END AS line_ok
  FROM calc c
),
reconciled AS (
  SELECT cv."invoiceId"
  FROM converted cv
  JOIN gross g ON g.id = cv."invoiceId"
  GROUP BY cv."invoiceId", g.subtotal, g."taxAmount", g."totalAmount"
  HAVING bool_and(cv.line_ok)
     AND SUM(cv.net_total) = g.subtotal
     AND g.subtotal + g."taxAmount" = g."totalAmount"
)
UPDATE "invoice_items" it
SET "totalPrice" = cv.net_total,
    "unitPrice" = cv.new_unit,
    "discountAmount" = cv.new_discount
FROM converted cv
WHERE cv.id = it.id
  AND cv."invoiceId" IN (SELECT "invoiceId" FROM reconciled);
