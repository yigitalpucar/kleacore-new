"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { formatDate } from "@/lib/format/date";

function revalidateAdminDomain(domainId: string) {
  revalidatePath(`/yonetim/domainler/${domainId}`);
  revalidatePath("/yonetim/domainler");
}

const RENEW_ERRORS: Record<string, string> = {
  DOMAIN_NOT_FOUND: "Alan adı bulunamadı",
  REGISTRAR_NOT_CONFIGURED: "Registrar etkin değil veya API bilgileri eksik",
  RENEWAL_BUSY: "Bu yenileme şu anda işleniyor; birkaç dakika sonra tekrar deneyin",
  ALREADY_COMPLETED: "Bu yenileme zaten tamamlanmış",
};

function renewErrorMessage(error: string) {
  if (error.startsWith("OPEN_INVOICE:")) {
    return `Bu dönem için ödenmemiş yenileme faturası var (${error.slice("OPEN_INVOICE:".length)}). Önce ödemeyi alın veya faturayı iptal edin.`;
  }
  return RENEW_ERRORS[error] ?? `Registrar yenilemesi başarısız: ${error}`;
}

/** "Registrar'da yenile": runs the registrar renew now (paid renewal, or a no-invoice admin renewal). */
export async function renewDomainAtRegistrar(domainId: string) {
  const session = await requireAdmin();
  const { manualRegistrarRenew } = await import("@/lib/domains/renew");

  try {
    const result = await manualRegistrarRenew(domainId, session.user.id);
    revalidateAdminDomain(domainId);
    if (!result.ok) return { success: false as const, error: renewErrorMessage(result.error) };
    return { success: true as const, message: `Yenilendi; yeni bitiş ${formatDate(result.newExpiresAt)}` };
  } catch (error) {
    console.error("[Domains] Registrar yenilemesi başarısız:", error);
    return { success: false as const, error: "Registrar yenilemesi başarısız oldu" };
  }
}

/** "Senkronize et": pulls status/expiry/nameservers from the registrar now. */
export async function syncDomainNow(domainId: string) {
  const session = await requireAdmin();
  const { syncDomainWithRegistrar } = await import("@/lib/domains/sync");

  try {
    const result = await syncDomainWithRegistrar(domainId, session.user.id);
    revalidateAdminDomain(domainId);
    if (!result.ok) {
      return {
        success: false as const,
        error: result.skipped ? "Registrar etkin değil veya bu işlemi desteklemiyor" : `Senkron başarısız: ${result.error}`,
      };
    }
    return {
      success: true as const,
      message: result.changed ? `${result.diffs.length} alan güncellendi` : "Registrar ile veriler aynı",
    };
  } catch (error) {
    console.error("[Domains] Registrar senkronu başarısız:", error);
    return { success: false as const, error: "Senkron başarısız oldu" };
  }
}
