import { db } from "@/lib/db";
import { createDomainRenewalInvoice, type RenewalInvoiceSkipReason } from "./renewal-invoices";
import { recordDomainEvent } from "./lifecycle";

/**
 * Customer-panel domain lifecycle operations (ownership checked here; the
 * server actions in src/lib/actions/customer/domains.ts only add auth +
 * revalidation).
 */

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

const RENEWABLE_STATUSES = new Set(["ACTIVE", "EXPIRED"]);

const SKIP_MESSAGES: Record<RenewalInvoiceSkipReason, string> = {
  NO_TLD_PRICE: "Bu uzantı için yenileme fiyatı tanımlı değil; lütfen destek talebi açın.",
  RENEWAL_IN_PROGRESS: "Bu dönemin yenilemesi zaten ödendi ve işleniyor.",
  RENEWAL_FAILED: "Bu dönemin yenilemesi ödendi; ekibimiz işlemi tamamlıyor.",
  INVOICE_CANCELLED: "Yenileme faturası iptal edilmiş; lütfen destek talebi açın.",
  CONCURRENT: "Yenileme faturası şu anda oluşturuluyor; birkaç saniye sonra tekrar deneyin.",
};

async function loadOwnedDomain(domainId: string, customerId: string) {
  const domain = await db.domain.findUnique({
    where: { id: domainId },
    select: { id: true, name: true, customerId: true, expiresAt: true, status: true, autoRenew: true },
  });
  if (!domain || domain.customerId !== customerId) return null;
  return domain;
}

export async function setAutoRenewForCustomer(
  domainId: string,
  customerId: string,
  enabled: boolean
): Promise<Result<{ autoRenew: boolean }>> {
  const domain = await loadOwnedDomain(domainId, customerId);
  if (!domain) return { success: false, error: "Alan adı bulunamadı" };

  if (domain.autoRenew !== enabled) {
    await db.domain.update({ where: { id: domainId }, data: { autoRenew: enabled } });
    await recordDomainEvent({
      domainId,
      type: "auto_renew.changed",
      message: enabled ? "Müşteri otomatik yenilemeyi açtı" : "Müşteri otomatik yenilemeyi kapattı",
      details: { autoRenew: enabled },
      actorId: customerId,
    });
  }

  return { success: true, autoRenew: enabled };
}

/** "Şimdi yenile": returns the current period's renewal invoice, creating it if needed. */
export async function requestRenewalForCustomer(
  domainId: string,
  customerId: string
): Promise<Result<{ invoiceId: string; created: boolean }>> {
  const domain = await loadOwnedDomain(domainId, customerId);
  if (!domain) return { success: false, error: "Alan adı bulunamadı" };

  if (!RENEWABLE_STATUSES.has(domain.status)) {
    return { success: false, error: "Bu alan adı şu anda yenilenemez (transfer veya kayıt sürüyor)." };
  }

  const result = await createDomainRenewalInvoice(domain, {
    source: "customer",
    reopenCancelled: true,
    actorId: customerId,
  });

  if (result.status === "skipped") {
    return { success: false, error: SKIP_MESSAGES[result.reason] };
  }

  return { success: true, invoiceId: result.invoiceId, created: result.status === "created" };
}
