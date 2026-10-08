/** Mapping summary shared by the CLI dry-run (scripts/import-preview.ts) and tests. Pure. */
import { buildProposal, isProposalReady, type MatchContext } from "./mapping";
import type { ImportProposal, ImportRecord } from "./types";

export interface PreviewLine {
  remoteId: string;
  label: string;
  action: ImportProposal["action"];
  customer: string;
  product: string;
  billing: string;
  status: string;
  ready: boolean;
  notes: string[];
}

export interface PreviewSummary {
  total: number;
  ready: number;
  needsAttention: number;
  alreadyImported: number;
  link: number;
  customers: { byEmail: number; byDomain: number; new: number; none: number };
  products: { matched: number; unmatched: number };
  suspended: number;
  lines: PreviewLine[];
}

function customerText(p: ImportProposal) {
  if (p.customer.mode === "existing") return `${p.customer.email} [${p.customer.matchedBy}]`;
  if (p.customer.mode === "new") return `YENİ ${p.customer.email}`;
  return "—";
}

export function summarizePreview(records: ImportRecord[], ctx: MatchContext): PreviewSummary {
  const summary: PreviewSummary = {
    total: records.length,
    ready: 0,
    needsAttention: 0,
    alreadyImported: 0,
    link: 0,
    customers: { byEmail: 0, byDomain: 0, new: 0, none: 0 },
    products: { matched: 0, unmatched: 0 },
    suspended: 0,
    lines: [],
  };
  const productName = new Map(ctx.products.map((p) => [p.id, p.name]));

  for (const record of records) {
    const p = buildProposal(record, ctx);
    const ready = isProposalReady(record, p);
    if (p.existingId) summary.alreadyImported += 1;
    else if (p.action === "link") summary.link += 1;
    else if (ready) summary.ready += 1;
    else summary.needsAttention += 1;

    if (!p.existingId && p.action === "import") {
      if (p.customer.mode === "existing") summary.customers[p.customer.matchedBy === "email" ? "byEmail" : "byDomain"] += 1;
      else summary.customers[p.customer.mode] += 1;
      if (record.kind !== "domain") summary.products[p.productId ? "matched" : "unmatched"] += 1;
    }
    if (p.serviceStatus === "SUSPENDED") summary.suspended += 1;

    summary.lines.push({
      remoteId: record.remoteId,
      label: record.kind === "account" ? (record.domain ?? record.username) : record.name,
      action: p.action,
      customer: customerText(p),
      product: record.kind === "domain" ? "—" : p.productId ? `${productName.get(p.productId)} [${p.productMatchedBy}]` : "—",
      billing: record.kind === "domain" ? `bitiş ${p.nextDueDate ?? "?"}` : `${p.billingPeriod} vade ${p.nextDueDate ?? "?"}`,
      status: record.kind === "domain" ? p.domainStatus : p.serviceStatus,
      ready,
      notes: p.notes,
    });
  }
  return summary;
}
