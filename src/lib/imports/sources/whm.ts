/** WHM accounts through the instance's ServerModule.listAccounts (read-only listaccts). */
import type { RemoteAccount, ServerModule } from "@/lib/modules/contracts";
import type { ImportedAccount } from "../types";
import { ImportSourceError } from "./errors";

export function toImportedAccount(account: RemoteAccount): ImportedAccount {
  return {
    kind: "account",
    remoteId: account.remoteId,
    username: account.username ?? account.remoteId,
    domain: account.domain ?? null,
    email: account.email ?? null,
    plan: account.package ?? null,
    diskUsedMB: account.diskUsedMB ?? null,
    diskLimitMB: account.diskLimitMB ?? null,
    suspended: account.status === "suspended",
    suspendReason: account.suspendReason ?? null,
    createdAt: account.createdAt ? account.createdAt.toISOString() : null,
    ipAddresses: account.ipAddress ? [account.ipAddress] : [],
  };
}

export async function listWhmAccounts(contract: ServerModule): Promise<ImportedAccount[]> {
  if (!contract.listAccounts) throw new ImportSourceError("Bu sunucu modülü hesap listelemeyi desteklemiyor.");
  const result = await contract.listAccounts();
  if (!result.ok) throw new ImportSourceError(`Hesap listesi alınamadı: ${result.error ?? "bilinmeyen hata"}`);
  return (result.data ?? []).filter((account) => account.remoteId).map(toImportedAccount);
}
