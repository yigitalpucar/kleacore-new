-- One official document number per e-invoice record. Existing rows carry either
-- NULL or the (already unique) KLEACORE invoice number, so this is safe on live data;
-- if it ever fails, inspect duplicates with:
--   SELECT "documentNumber", count(*) FROM e_invoice_records GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX "e_invoice_records_documentNumber_key" ON "e_invoice_records"("documentNumber");
