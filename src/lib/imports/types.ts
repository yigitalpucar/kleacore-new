/**
 * Import of existing infrastructure (Faz 2.7) — shared types.
 *
 * Flow: ImportRun (QUEUED) → "import.fetch" job lists the source through the
 * module instance (read-only), normalises every record into an ImportRecord
 * and proposes a mapping (ImportProposal) → admin reviews/edits rows on
 * /yonetim/ice-aktar/[id] → "import.apply" job creates Service / Domain rows
 * bound to the instance. Nothing is ever written to the remote system and no
 * invoice is created.
 */
import type { BillingPeriod, DomainStatus, ImportSourceKind } from "@prisma/client";

/** WHM account (listaccts). */
export interface ImportedAccount {
  kind: "account";
  remoteId: string;
  username: string;
  domain: string | null;
  email: string | null;
  plan: string | null;
  diskUsedMB: number | null;
  diskLimitMB: number | null;
  suspended: boolean;
  suspendReason: string | null;
  /** ISO date. */
  createdAt: string | null;
  ipAddresses: string[];
}

/** Proxmox VM (cluster/resources + per-VM config). */
export interface ImportedVirtualMachine {
  kind: "vm";
  /** VMID. */
  remoteId: string;
  name: string;
  node: string | null;
  status: "running" | "stopped" | "unknown";
  cores: number | null;
  memoryMB: number | null;
  diskGB: number | null;
  ipAddresses: string[];
  /** ISO date (VM "meta: ctime"), when known. */
  createdAt: string | null;
}

/** Registrar domain (listDomains + getDomainInfo). */
export interface ImportedDomain {
  kind: "domain";
  /** Domain name. */
  remoteId: string;
  name: string;
  /** ISO date. */
  expiresAt: string | null;
  status: string | null;
  nameservers: string[];
  autoRenew: boolean | null;
}

export type ImportRecord = ImportedAccount | ImportedVirtualMachine | ImportedDomain;

export type ImportAction = "import" | "link" | "skip";

export type CustomerProposal =
  | { mode: "existing"; userId: string; email: string; label: string; matchedBy: "email" | "domain" | "manual" }
  | { mode: "new"; email: string; name: string; surname: string }
  | { mode: "none" };

/** Admin-editable mapping of one row. Dates are "YYYY-MM-DD"; money is a decimal string. */
export interface ImportProposal {
  action: ImportAction;
  customer: CustomerProposal;
  /** Service imports (WHM / Proxmox). */
  productId: string | null;
  productMatchedBy: "package" | "sku" | "resources" | "manual" | null;
  billingPeriod: BillingPeriod;
  nextDueDate: string | null;
  /** Empty = product price for the period. */
  amountOverride: string | null;
  serviceStatus: "ACTIVE" | "SUSPENDED";
  /** Domain imports. */
  domainStatus: DomainStatus;
  autoRenew: boolean;
  /** Existing legacy service (no instance binding) that is this account — action "link". */
  linkServiceId: string | null;
  /** Already imported (service / domain id) — the row is skipped. */
  existingId: string | null;
  /** Human-readable notes for the preview ("Paket eşleşmedi", …). */
  notes: string[];
}

export const IMPORT_SOURCE_LABELS: Record<ImportSourceKind, string> = {
  WHM: "cPanel/WHM hesapları",
  PROXMOX: "Proxmox sanal sunucuları",
  REGISTRAR: "Alan adları (registrar)",
};

/** Module kind + module ids that can feed each source. */
export const IMPORT_SOURCE_MODULES: Record<ImportSourceKind, { kind: "server" | "registrar"; moduleIds: string[] }> = {
  WHM: { kind: "server", moduleIds: ["cpanel-whm"] },
  PROXMOX: { kind: "server", moduleIds: ["proxmox"] },
  REGISTRAR: { kind: "registrar", moduleIds: [] /* any registrar with listDomains */ },
};

export const IMPORT_SUSPEND_REASON = "İçe aktarma";
