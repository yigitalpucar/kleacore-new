/** Registrar domains through RegistrarModule.listDomains (+ getDomainInfo for missing fields). */
import type { RegistrarModule } from "@/lib/modules/contracts";
import type { ImportedDomain } from "../types";
import { ImportSourceError, mapLimit } from "./errors";

export async function listRegistrarDomains(contract: RegistrarModule): Promise<ImportedDomain[]> {
  if (!contract.listDomains) throw new ImportSourceError("Bu registrar modülü alan adı listelemeyi desteklemiyor.");
  const result = await contract.listDomains();
  if (!result.ok) throw new ImportSourceError(`Alan adı listesi alınamadı: ${result.error ?? "bilinmeyen hata"}`);

  return mapLimit(result.data ?? [], 4, async (item): Promise<ImportedDomain> => {
    let expiresAt = item.expiresAt ?? null;
    let status = item.status ?? null;
    let nameservers = item.nameservers ?? [];
    // The list may omit details; getDomainInfo is read-only. A failure leaves the field empty for the admin.
    if (!expiresAt || nameservers.length === 0) {
      const info = await contract.getDomainInfo(item.domain);
      if (info.ok && info.data) {
        expiresAt = expiresAt ?? info.data.expiresAt ?? null;
        status = status ?? info.data.status ?? null;
        nameservers = nameservers.length ? nameservers : (info.data.nameservers ?? []);
      }
    }
    const name = item.domain.trim().toLowerCase();
    return {
      kind: "domain",
      remoteId: name,
      name,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      status,
      nameservers,
      autoRenew: item.autoRenew ?? null,
    };
  });
}
