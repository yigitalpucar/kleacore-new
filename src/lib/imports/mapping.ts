/**
 * Pure mapping rules of the importer (Faz 2.7): remote record → proposed
 * customer / product / billing / status. No database access here — the
 * caller preloads a MatchContext (./context.ts) so the rules are unit-tested
 * in isolation and the CLI preview prints exactly what the UI proposes.
 */
import type { BillingPeriod, DomainStatus } from "@prisma/client";
import { periodMonths, productPeriodPricing } from "@/lib/billing/period-price";
import { money, toNumber, type MoneyInput } from "@/lib/money";
import type {
  CustomerProposal,
  ImportProposal,
  ImportRecord,
  ImportedAccount,
  ImportedDomain,
  ImportedVirtualMachine,
} from "./types";

export interface CustomerRef {
  id: string;
  email: string;
  /** "Ad Soyad" or company. */
  label: string;
}

export interface ProductCandidate {
  id: string;
  name: string;
  sku: string;
  categorySlug: string;
  moduleInstanceId: string | null;
  moduleOptions: Record<string, unknown>;
  basePrice: MoneyInput;
  pricingTiers: Array<{ period: string; price: MoneyInput; isDefault: boolean }>;
}

export interface LegacyServiceRef {
  id: string;
  customerId: string;
  username: string | null;
  serverName: string | null;
  domain: string | null;
}

export interface MatchContext {
  now: Date;
  instanceId: string;
  /** Lower-cased email → customer. */
  customersByEmail: Map<string, CustomerRef>;
  /** Lower-cased domain (Service.domain, Domain.name) → customer. */
  customersByDomain: Map<string, CustomerRef>;
  products: ProductCandidate[];
  /** remoteId → service id, for services already bound to this instance. */
  importedServices: Map<string, string>;
  /** Services without an instance binding (pre-2.2), candidates for "link". */
  legacyServices: LegacyServiceRef[];
  /** Lower-cased domain name → Domain id (Domain.name is globally unique). */
  existingDomains: Map<string, string>;
}

export const SERVICE_CATEGORIES_BY_SOURCE = {
  account: ["hosting", "email"],
  vm: ["vds", "vps", "server", "cloud"],
} as const;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function normalizeEmailAddress(value: string | null | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizeDomain(value: string | null | undefined) {
  const domain = value?.trim().toLowerCase().replace(/\.$/, "") ?? "";
  return domain.includes(".") && !/\s/.test(domain) ? domain : null;
}

/** "YYYY-MM-DD" of a date in UTC. */
export function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Start of the UTC day. */
export function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Adds calendar months in UTC, clamping the day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const target = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

/**
 * Next renewal date on or after today: the account's creation anniversary
 * stepped by the billing period, else one period from today. Never in the
 * past, so the renewal cron only ever invoices future periods.
 */
export function proposeNextDueDate(createdAt: Date | null, period: BillingPeriod, now: Date): Date {
  const months = periodMonths(period);
  const today = startOfDay(now);
  if (!createdAt || Number.isNaN(createdAt.getTime())) return addMonths(today, months);
  const start = startOfDay(createdAt);
  if (start.getTime() >= today.getTime()) return addMonths(start, months);
  const elapsed =
    (today.getUTCFullYear() - start.getUTCFullYear()) * 12 + (today.getUTCMonth() - start.getUTCMonth());
  let steps = Math.max(1, Math.floor(elapsed / months));
  let due = addMonths(start, steps * months);
  while (due.getTime() < today.getTime()) {
    steps += 1;
    due = addMonths(start, steps * months);
  }
  return due;
}

function domainCandidates(domain: string) {
  // ornek.com.tr → [ornek.com.tr, com.tr] (the last is never a customer domain, harmless)
  const parts = domain.split(".");
  const out: string[] = [];
  for (let i = 0; i < parts.length - 1; i += 1) out.push(parts.slice(i).join("."));
  return out;
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const words = local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1));
  return { name: words[0] ?? local, surname: words.slice(1).join(" ") };
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

function matchByDomain(domain: string | null, ctx: MatchContext): CustomerRef | null {
  if (!domain) return null;
  for (const candidate of domainCandidates(domain)) {
    const hit = ctx.customersByDomain.get(candidate);
    if (hit) return hit;
  }
  return null;
}

/**
 * Customer of a remote record: exact e-mail (case-insensitive) first, then a
 * known domain (the account's / VM hostname's / domain's own, or a parent
 * domain), else a new customer from the account e-mail, else none (admin picks).
 */
export function matchCustomer(record: ImportRecord, ctx: MatchContext): CustomerProposal {
  const email = record.kind === "account" ? normalizeEmailAddress(record.email) : null;
  if (email) {
    const byEmail = ctx.customersByEmail.get(email);
    if (byEmail) return { mode: "existing", userId: byEmail.id, email: byEmail.email, label: byEmail.label, matchedBy: "email" };
  }

  const domain =
    record.kind === "account"
      ? normalizeDomain(record.domain)
      : record.kind === "vm"
        ? normalizeDomain(record.name)
        : normalizeDomain(record.name);
  const byDomain = matchByDomain(domain, ctx);
  if (byDomain) return { mode: "existing", userId: byDomain.id, email: byDomain.email, label: byDomain.label, matchedBy: "domain" };

  if (email) return { mode: "new", email, ...nameFromEmail(email) };
  return { mode: "none" };
}

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

function optionString(options: Record<string, unknown>, key: string) {
  const value = options[key];
  return typeof value === "string" ? value.trim() : "";
}

function optionNumber(options: Record<string, unknown>, key: string) {
  const value = options[key];
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

/** Products bound to this instance first, then the rest (stable). */
function preferInstance(products: ProductCandidate[], instanceId: string) {
  return [...products].sort(
    (a, b) => Number(b.moduleInstanceId === instanceId) - Number(a.moduleInstanceId === instanceId)
  );
}

/** Reseller WHM packages are "<owner>_<name>"; "kleacore_Baslangic" → "baslangic". */
function packageVariants(plan: string) {
  const lower = plan.toLowerCase();
  const underscore = lower.indexOf("_");
  return underscore > 0 ? [lower, lower.slice(underscore + 1)] : [lower];
}

/**
 * WHM plan → product: moduleOptions.package equal to the plan (exact, then
 * case-insensitive, then without the reseller prefix), else the product SKU
 * (the legacy provider used the SKU as the package name).
 */
export function matchAccountProduct(record: ImportedAccount, ctx: MatchContext) {
  if (!record.plan) return { productId: null, matchedBy: null } as const;
  const products = preferInstance(
    ctx.products.filter((p) => (SERVICE_CATEGORIES_BY_SOURCE.account as readonly string[]).includes(p.categorySlug)),
    ctx.instanceId
  );
  const variants = packageVariants(record.plan);

  const exact = products.find((p) => optionString(p.moduleOptions, "package") === record.plan);
  if (exact) return { productId: exact.id, matchedBy: "package" } as const;
  const loose = products.find((p) => {
    const pkg = optionString(p.moduleOptions, "package").toLowerCase();
    return pkg !== "" && packageVariants(pkg).some((v) => variants.includes(v));
  });
  if (loose) return { productId: loose.id, matchedBy: "package" } as const;
  const bySku = products.find((p) => p.sku && variants.includes(p.sku.toLowerCase()));
  if (bySku) return { productId: bySku.id, matchedBy: "sku" } as const;
  return { productId: null, matchedBy: null } as const;
}

/** VM → product with the same cores and memory in its Proxmox options (bound to this instance first). */
export function matchVirtualMachineProduct(record: ImportedVirtualMachine, ctx: MatchContext) {
  if (!record.cores || !record.memoryMB) return { productId: null, matchedBy: null } as const;
  const products = preferInstance(
    ctx.products.filter((p) => (SERVICE_CATEGORIES_BY_SOURCE.vm as readonly string[]).includes(p.categorySlug)),
    ctx.instanceId
  );
  const hit = products.find(
    (p) =>
      optionNumber(p.moduleOptions, "cores") === record.cores &&
      optionNumber(p.moduleOptions, "memoryMB") === record.memoryMB
  );
  return hit ? ({ productId: hit.id, matchedBy: "resources" } as const) : ({ productId: null, matchedBy: null } as const);
}

// ---------------------------------------------------------------------------
// Billing & status
// ---------------------------------------------------------------------------

export function defaultPeriodFor(product: ProductCandidate | undefined): BillingPeriod {
  const tier = product?.pricingTiers.find((t) => t.isDefault) ?? product?.pricingTiers[0];
  return (tier?.period as BillingPeriod | undefined) ?? "monthly";
}

/**
 * Service.amount for one period: the admin override when given, else the
 * catalogue price of the period (same rule as admin "hizmet ekle").
 * Returns a 2-decimal string; throws on an invalid override.
 */
export function resolveServiceAmount(product: ProductCandidate, period: BillingPeriod, override: string | null) {
  if (override !== null && override.trim() !== "") {
    const normalized = override.trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Fiyat geçersiz (ör. 149.90).");
    return money(normalized).toFixed(2);
  }
  const { total } = productPeriodPricing(
    { basePrice: product.basePrice, categorySlug: product.categorySlug, pricingTiers: product.pricingTiers },
    period
  );
  return money(total).toFixed(2);
}

export function mapServiceStatus(record: ImportedAccount | ImportedVirtualMachine): "ACTIVE" | "SUSPENDED" {
  return record.kind === "account" && record.suspended ? "SUSPENDED" : "ACTIVE";
}

/** Registrar status text → DomainStatus; a past expiry is EXPIRED whatever the text says. */
export function mapDomainStatus(record: ImportedDomain, now: Date): DomainStatus {
  const status = record.status?.toLowerCase() ?? "";
  if (record.expiresAt && new Date(record.expiresAt).getTime() < now.getTime()) return "EXPIRED";
  if (status.includes("expire") || status.includes("redemption")) return "EXPIRED";
  if (status.includes("transfer")) return "TRANSFERRING";
  if (status.includes("pending")) return "PENDING";
  return "ACTIVE";
}

// ---------------------------------------------------------------------------
// Proposal
// ---------------------------------------------------------------------------

function findLegacyService(record: ImportedAccount, ctx: MatchContext) {
  const user = record.username.toLowerCase();
  return ctx.legacyServices.find(
    (s) => s.username?.trim().toLowerCase() === user || s.serverName?.trim().toLowerCase() === user
  );
}

export function buildProposal(record: ImportRecord, ctx: MatchContext): ImportProposal {
  const notes: string[] = [];
  const base: ImportProposal = {
    action: "import",
    customer: matchCustomer(record, ctx),
    productId: null,
    productMatchedBy: null,
    billingPeriod: "monthly",
    nextDueDate: null,
    amountOverride: null,
    serviceStatus: "ACTIVE",
    domainStatus: "ACTIVE",
    autoRenew: true,
    linkServiceId: null,
    existingId: null,
    notes,
  };

  if (record.kind === "domain") {
    const existing = ctx.existingDomains.get(record.name.toLowerCase());
    if (existing) {
      notes.push("Bu alan adı KLEACORE'da zaten kayıtlı.");
      return { ...base, action: "skip", existingId: existing };
    }
    if (!record.expiresAt) notes.push("Bitiş tarihi alınamadı; elle girin.");
    return {
      ...base,
      nextDueDate: record.expiresAt ? record.expiresAt.slice(0, 10) : null,
      domainStatus: mapDomainStatus(record, ctx.now),
      autoRenew: record.autoRenew ?? true,
      billingPeriod: "yearly",
    };
  }

  const existing = ctx.importedServices.get(record.remoteId);
  if (existing) {
    notes.push("Bu uzak kimlik bu örnekte zaten bir hizmete bağlı.");
    return { ...base, action: "skip", existingId: existing };
  }

  const match = record.kind === "account" ? matchAccountProduct(record, ctx) : matchVirtualMachineProduct(record, ctx);
  const product = match.productId ? ctx.products.find((p) => p.id === match.productId) : undefined;
  if (!product) {
    notes.push(
      record.kind === "account"
        ? `"${record.plan ?? "—"}" paketine bağlı ürün bulunamadı; ürün seçin.`
        : "Çekirdek/bellek değerleri bir ürünle eşleşmedi; ürün seçin."
    );
  }
  const period = defaultPeriodFor(product);
  const createdAt = record.createdAt ? new Date(record.createdAt) : null;
  const serviceStatus = mapServiceStatus(record);
  if (serviceStatus === "SUSPENDED") notes.push(`WHM'de askıda${record.kind === "account" && record.suspendReason ? `: ${record.suspendReason}` : ""}.`);
  if (record.kind === "vm" && record.status === "stopped") notes.push("VM kapalı; hizmet aktif olarak açılır.");

  const proposal: ImportProposal = {
    ...base,
    productId: product?.id ?? null,
    productMatchedBy: match.matchedBy,
    billingPeriod: period,
    nextDueDate: toDateOnly(proposeNextDueDate(createdAt, period, ctx.now)),
    serviceStatus,
  };

  if (record.kind === "account") {
    const legacy = findLegacyService(record, ctx);
    if (legacy) {
      notes.push("Örneğe bağlı olmayan mevcut bir hizmetle eşleşti; yeni hizmet yerine bağlanması önerilir.");
      return { ...proposal, action: "link", linkServiceId: legacy.id };
    }
  }
  if (proposal.customer.mode === "none") notes.push("Müşteri eşleşmedi; müşteri seçin veya yeni müşteri bilgisi girin.");
  return proposal;
}

/** Row is importable as proposed (used for "select all ready rows"). */
export function isProposalReady(record: ImportRecord, proposal: ImportProposal) {
  if (proposal.action === "skip") return false;
  if (proposal.action === "link") return Boolean(proposal.linkServiceId);
  if (proposal.customer.mode === "none") return false;
  if (!proposal.nextDueDate) return false;
  return record.kind === "domain" || Boolean(proposal.productId);
}

export function amountPreview(product: ProductCandidate | undefined, proposal: ImportProposal): number | null {
  if (!product) return null;
  try {
    return toNumber(resolveServiceAmount(product, proposal.billingPeriod, proposal.amountOverride));
  } catch {
    return null;
  }
}
