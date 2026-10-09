"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { formatDate } from "@/lib/format/date";
import { renewErrorMessage } from "@/lib/domains/admin-messages";

function revalidateAdminDomain(domainId: string) {
  revalidatePath(`/yonetim/domainler/${domainId}`);
  revalidatePath("/yonetim/domainler");
}

/** "Registrar'da yenile": runs the registrar renew now (paid renewal, or a no-invoice admin renewal). */
export async function renewDomainAtRegistrar(domainId: string) {
  const session = await requirePermission("domains.manage");
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
  const session = await requirePermission("domains.manage");
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
