-- Data migration: OrderItem uses the same net semantics as InvoiceItem
-- (20261008170000_invoice_item_net):
--   unitPrice      net (KDV-exclusive) unit price before the line discount
--   discountAmount net line discount
--   totalPrice     net line total = unitPrice × quantity − discountAmount
-- KDV lives on the order only: Σ totalPrice = totalAmount − taxAmount.
--
-- Checkout and domain transfer stored the KDV-inclusive total in totalPrice
-- (unitPrice/discount already net); service renewal, the renewal cron and
-- plan changes stored it in unitPrice too. Such orders are recognised by
-- Σ totalPrice = totalAmount ≠ totalAmount − taxAmount and rewritten:
--   unitPrice was gross (unitPrice × qty = totalPrice):
--     net        = round_half_up(totalPrice × 100 / (100 + taxRate), 2)
--     unitPrice  = (net + discountAmount) / quantity   (must divide exactly)
--   unitPrice was net:
--     totalPrice = round(unitPrice × quantity, 2) − discountAmount
-- An order is rewritten only if afterwards Σ totalPrice = totalAmount −
-- taxAmount to the kuruş and every line is ≥ 0. Anything else is left
-- untouched and listed by scripts/sql/order-item-net-check.sql. Idempotent:
-- converted orders are "net" and not matched again. Touches no money that
-- was charged (orders/invoices/payments keep their totals).
WITH ord AS (
  SELECT o.id, o."taxRate", o."taxAmount", o."totalAmount",
         SUM(it."totalPrice") AS lines_sum
  FROM "orders" o
  JOIN "order_items" it ON it."orderId" = o.id
  GROUP BY o.id
),
gross AS (
  SELECT * FROM ord
  WHERE lines_sum = "totalAmount"
    AND lines_sum <> "totalAmount" - "taxAmount"
    AND "taxRate" >= 0
),
calc AS (
  SELECT it.id,
         it."orderId",
         it.quantity,
         it."unitPrice",
         it."discountAmount",
         (it."unitPrice" * it.quantity = it."totalPrice") AS unit_was_gross,
         ROUND(it."totalPrice" * 100 / (100 + g."taxRate"), 2) AS net_from_gross
  FROM "order_items" it
  JOIN gross g ON g.id = it."orderId"
),
converted AS (
  SELECT c.id,
         c."orderId",
         CASE WHEN c.unit_was_gross
              THEN ROUND((c.net_from_gross + c."discountAmount") / c.quantity, 2)
              ELSE c."unitPrice" END AS new_unit,
         CASE WHEN c.unit_was_gross
              THEN c.net_from_gross
              ELSE ROUND(c."unitPrice" * c.quantity, 2) - c."discountAmount" END AS new_total,
         CASE WHEN c.unit_was_gross
              THEN ROUND((c.net_from_gross + c."discountAmount") / c.quantity, 2) * c.quantity
                   = c.net_from_gross + c."discountAmount"
              ELSE TRUE END AS unit_ok
  FROM calc c
),
reconciled AS (
  SELECT cv."orderId"
  FROM converted cv
  JOIN gross g ON g.id = cv."orderId"
  GROUP BY cv."orderId", g."taxAmount", g."totalAmount"
  HAVING bool_and(cv.unit_ok AND cv.new_total >= 0)
     AND SUM(cv.new_total) = g."totalAmount" - g."taxAmount"
)
UPDATE "order_items" it
SET "unitPrice" = cv.new_unit,
    "totalPrice" = cv.new_total
FROM converted cv
WHERE cv.id = it.id
  AND cv."orderId" IN (SELECT "orderId" FROM reconciled);
