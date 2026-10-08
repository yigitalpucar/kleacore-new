-- Money columns: double precision -> numeric.
-- Amounts are numeric(14,2) (kuruş precision, up to 999.999.999.999,99 TL);
-- rates/percentages are numeric(5,2). Existing values are rounded half-up to
-- 2 decimals (round(numeric) is half-away-from-zero), so no row is rejected
-- and SUM() per column is unchanged for kuruş-exact data.

ALTER TABLE "affiliate_payments"
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2) USING round("amount"::numeric, 2);

ALTER TABLE "affiliate_referrals"
  ALTER COLUMN "commission" SET DATA TYPE DECIMAL(14,2) USING round("commission"::numeric, 2);

ALTER TABLE "domain_tlds"
  ALTER COLUMN "registerPrice" SET DATA TYPE DECIMAL(14,2) USING round("registerPrice"::numeric, 2),
  ALTER COLUMN "renewPrice" SET DATA TYPE DECIMAL(14,2) USING round("renewPrice"::numeric, 2),
  ALTER COLUMN "transferPrice" SET DATA TYPE DECIMAL(14,2) USING round("transferPrice"::numeric, 2);

ALTER TABLE "invoice_items"
  ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(14,2) USING round("totalPrice"::numeric, 2),
  ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,2) USING round("unitPrice"::numeric, 2);

ALTER TABLE "invoices"
  ALTER COLUMN "paidAmount" SET DATA TYPE DECIMAL(14,2) USING round("paidAmount"::numeric, 2),
  ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(14,2) USING round("subtotal"::numeric, 2),
  ALTER COLUMN "taxAmount" SET DATA TYPE DECIMAL(14,2) USING round("taxAmount"::numeric, 2),
  ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(5,2) USING round("taxRate"::numeric, 2),
  ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(14,2) USING round("totalAmount"::numeric, 2);

ALTER TABLE "order_items"
  ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(14,2) USING round("discountAmount"::numeric, 2),
  ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(14,2) USING round("totalPrice"::numeric, 2),
  ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,2) USING round("unitPrice"::numeric, 2);

ALTER TABLE "orders"
  ALTER COLUMN "basePrice" SET DATA TYPE DECIMAL(14,2) USING round("basePrice"::numeric, 2),
  ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(14,2) USING round("discountAmount"::numeric, 2),
  ALTER COLUMN "refundAmount" SET DATA TYPE DECIMAL(14,2) USING round("refundAmount"::numeric, 2),
  ALTER COLUMN "setupFee" SET DATA TYPE DECIMAL(14,2) USING round("setupFee"::numeric, 2),
  ALTER COLUMN "taxAmount" SET DATA TYPE DECIMAL(14,2) USING round("taxAmount"::numeric, 2),
  ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(5,2) USING round("taxRate"::numeric, 2),
  ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(14,2) USING round("totalAmount"::numeric, 2);

ALTER TABLE "payments"
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2) USING round("amount"::numeric, 2);

ALTER TABLE "pricing_tiers"
  ALTER COLUMN "discountedPrice" SET DATA TYPE DECIMAL(14,2) USING round("discountedPrice"::numeric, 2),
  ALTER COLUMN "price" SET DATA TYPE DECIMAL(14,2) USING round("price"::numeric, 2),
  ALTER COLUMN "renewalPrice" SET DATA TYPE DECIMAL(14,2) USING round("renewalPrice"::numeric, 2),
  ALTER COLUMN "setupFee" SET DATA TYPE DECIMAL(14,2) USING round("setupFee"::numeric, 2);

ALTER TABLE "product_addons"
  ALTER COLUMN "monthlyPrice" SET DATA TYPE DECIMAL(14,2) USING round("monthlyPrice"::numeric, 2),
  ALTER COLUMN "setupFee" SET DATA TYPE DECIMAL(14,2) USING round("setupFee"::numeric, 2),
  ALTER COLUMN "yearlyPrice" SET DATA TYPE DECIMAL(14,2) USING round("yearlyPrice"::numeric, 2);

ALTER TABLE "product_config_options"
  ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,2) USING round("unitPrice"::numeric, 2),
  ALTER COLUMN "unitPriceYearly" SET DATA TYPE DECIMAL(14,2) USING round("unitPriceYearly"::numeric, 2);

ALTER TABLE "products"
  ALTER COLUMN "basePrice" SET DATA TYPE DECIMAL(14,2) USING round("basePrice"::numeric, 2);

ALTER TABLE "promotion_codes"
  ALTER COLUMN "discountValue" SET DATA TYPE DECIMAL(14,2) USING round("discountValue"::numeric, 2),
  ALTER COLUMN "minOrderAmount" SET DATA TYPE DECIMAL(14,2) USING round("minOrderAmount"::numeric, 2);

ALTER TABLE "service_plan_changes"
  ALTER COLUMN "proratedAmount" SET DATA TYPE DECIMAL(14,2) USING round("proratedAmount"::numeric, 2);

ALTER TABLE "services"
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2) USING round("amount"::numeric, 2);

ALTER TABLE "transactions"
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2) USING round("amount"::numeric, 2),
  ALTER COLUMN "balanceAfter" SET DATA TYPE DECIMAL(14,2) USING round("balanceAfter"::numeric, 2),
  ALTER COLUMN "balanceBefore" SET DATA TYPE DECIMAL(14,2) USING round("balanceBefore"::numeric, 2);

ALTER TABLE "users"
  ALTER COLUMN "balance" SET DATA TYPE DECIMAL(14,2) USING round("balance"::numeric, 2),
  ALTER COLUMN "resellerDiscountPercent" SET DATA TYPE DECIMAL(5,2) USING round("resellerDiscountPercent"::numeric, 2);
