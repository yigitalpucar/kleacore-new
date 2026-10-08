-- OrderItem.totalPrice = net (KDV hariç) satır toplamı kontrolü.
-- Migration 20261009130000_order_item_net öncesi ve sonrası çalıştırılır:
--   docker exec -i <pg> psql -U postgres -d <db> < scripts/sql/order-item-net-check.sql
--
-- class:
--   net        Σ satır totalPrice = totalAmount − taxAmount (doğru)
--   gross      Σ satır totalPrice = totalAmount ≠ net (eski KDV dahil yazıcılar)
--   mismatch   ikisi de değil → elle incelenmeli (migration dokunmaz)
--   no_items   satırı olmayan sipariş

\echo '== Sınıf özeti'
WITH ord AS (
  SELECT o.id, o."taxAmount", o."totalAmount",
         COUNT(it.id) AS lines, COALESCE(SUM(it."totalPrice"), 0) AS lines_sum
  FROM orders o LEFT JOIN order_items it ON it."orderId" = o.id
  GROUP BY o.id
)
SELECT CASE
         WHEN lines = 0 THEN 'no_items'
         WHEN lines_sum = "totalAmount" - "taxAmount" THEN 'net'
         WHEN lines_sum = "totalAmount" THEN 'gross'
         ELSE 'mismatch'
       END AS class,
       COUNT(*) AS orders,
       SUM(lines) AS lines,
       SUM("totalAmount") AS total_amount
FROM ord
GROUP BY 1
ORDER BY 1;

\echo '== Net olmayan siparişler (gross / mismatch)'
WITH ord AS (
  SELECT o.id, o."orderNumber", o.status, o."basePrice", o."discountAmount", o."setupFee",
         o."taxRate", o."taxAmount", o."totalAmount",
         COUNT(it.id) AS lines, COALESCE(SUM(it."totalPrice"), 0) AS lines_sum
  FROM orders o LEFT JOIN order_items it ON it."orderId" = o.id
  GROUP BY o.id
)
SELECT "orderNumber", status, lines, "basePrice", "discountAmount", "setupFee", "taxRate",
       "taxAmount", "totalAmount", lines_sum,
       lines_sum - ("totalAmount" - "taxAmount") AS diff_vs_net
FROM ord
WHERE lines > 0 AND lines_sum <> "totalAmount" - "taxAmount"
ORDER BY "orderNumber";
