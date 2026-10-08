/**
 * Lists a source through its module instance. Read-only: only list/info
 * calls are made, never a create/update on the remote system.
 */
import type { ImportSourceKind } from "@prisma/client";
import { createContract } from "@/lib/modules/instances";
import type { ResolvedModuleInstance } from "@/lib/modules/types";
import type { ImportRecord } from "../types";
import { IMPORT_SOURCE_MODULES } from "../types";
import { ImportSourceError } from "./errors";
import { getVirtualMachineLister, listProxmoxVirtualMachines } from "./proxmox";
import { listRegistrarDomains } from "./registrar";
import { listWhmAccounts } from "./whm";

export { ImportSourceError } from "./errors";

export function assertInstanceFitsSource(source: ImportSourceKind, instance: Pick<ResolvedModuleInstance, "kind" | "moduleId">) {
  const expected = IMPORT_SOURCE_MODULES[source];
  if (instance.kind !== expected.kind || (expected.moduleIds.length > 0 && !expected.moduleIds.includes(instance.moduleId))) {
    throw new ImportSourceError("Seçilen modül örneği bu kaynakla kullanılamaz.");
  }
}

export async function fetchSourceRecords(source: ImportSourceKind, instance: ResolvedModuleInstance): Promise<ImportRecord[]> {
  assertInstanceFitsSource(source, instance);
  switch (source) {
    case "WHM":
      return listWhmAccounts(createContract(instance, "server"));
    case "PROXMOX":
      return listProxmoxVirtualMachines(getVirtualMachineLister(createContract(instance, "server"), instance.config));
    case "REGISTRAR":
      return listRegistrarDomains(createContract(instance, "registrar"));
  }
}
