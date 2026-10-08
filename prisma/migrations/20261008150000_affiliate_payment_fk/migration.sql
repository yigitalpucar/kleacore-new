-- The schema has always declared this relation, but no migration created the
-- constraint. Orphan rows would block it; there are none in production data.
ALTER TABLE "affiliate_payments" ADD CONSTRAINT "affiliate_payments_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
