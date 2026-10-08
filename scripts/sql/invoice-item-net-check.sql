-- InvoiceItem.totalPrice = net (KDV hariç) satır toplamı kontrolü.
-- Migration 20261008170000_invoice_item_net öncesi ve sonrası çalıştırılır:
--   docker exec -i <pg> psql -U postgres -d <db> < scripts/sql/invoice-item-net-check.sql
--
-- class:
--   net        Σ satır totalPrice = subtotal ve subtotal + KDV = toplam (doğru)
--   gross      Σ satır totalPrice = toplam ≠ subtotal (eski KDV dahil yazıcılar)
--   mismatch   ikisi de değil → elle incelenmeli (migration dokunmaz)
--   no_items   satırı olmayan fatura

\echo '== Sınıf özeti'
WITH inv AS (
  SELECT i.id, i."invoiceNumber", i.status, i.subtotal, i."taxAmount", i."totalAmount",
         COUNT(it.id) AS lines, COALESCE(SUM(it."totalPrice"), 0) AS lines_sum
  FROM invoices i LEFT JOIN invoice_items it ON it."invoiceId" = i.id
  GROUP BY i.id
)
SELECT CASE
         WHEN lines = 0 THEN 'no_items'
         WHEN lines_sum = subtotal AND subtotal + "taxAmount" = "totalAmount" THEN 'net'
         WHEN lines_sum = "totalAmount" AND lines_sum <> subtotal THEN 'gross'
         ELSE 'mismatch'
       END AS class,
       COUNT(*) AS invoices,
       SUM(lines) AS lines,
       SUM("totalAmount") AS total_amount
FROM inv
GROUP BY 1
ORDER BY 1;

\echo '== Net olmayan faturalar (gross / mismatch / no_items)'
WITH inv AS (
  SELECT i.id, i."invoiceNumber", i.status, i.subtotal, i."taxRate", i."taxAmount", i."totalAmount",
         COUNT(it.id) AS lines, COALESCE(SUM(it."totalPrice"), 0) AS lines_sum
  FROM invoices i LEFT JOIN invoice_items it ON it."invoiceId" = i.id
  GROUP BY i.id
)
SELECT "invoiceNumber", status, lines, subtotal, "taxRate", "taxAmount", "totalAmount", lines_sum,
       lines_sum - subtotal AS diff_vs_subtotal
FROM inv
WHERE NOT (lines > 0 AND lines_sum = subtotal AND subtotal + "taxAmount" = "totalAmount")
ORDER BY "invoiceNumber";
