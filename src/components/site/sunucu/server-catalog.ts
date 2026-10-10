import { getProductsBySubType } from "@/lib/dal/products";
import type { ProductWithPricing } from "@/lib/products/map-product";
import type { CartPlanRow } from "./cart-plan-table";
import { toNumber } from "@/lib/money";
import { isUnverifiedClaim } from "@/lib/catalog/package-comparison";

export type ServerFamilyKey = "vps" | "vds" | "bulut" | "fiziksel";

export const serverFamilyOrder: ServerFamilyKey[] = ["vps", "vds", "bulut", "fiziksel"];

export const serverFamilyMeta: Record<
  ServerFamilyKey,
  { label: string; noun: string; href: string; cartCategory: "vds" | "vps" | "cloud" | "fiziksel" }
> = {
  vps: { noun: "VPS sunucu", label: "VPS", href: "/sunucu/vps", cartCategory: "vps" },
  vds: { noun: "VDS sunucu", label: "VDS", href: "/sunucu/vds", cartCategory: "vds" },
  bulut: { noun: "bulut sunucu", label: "Bulut", href: "/sunucu/bulut", cartCategory: "cloud" },
  fiziksel: { noun: "fiziksel sunucu", label: "Fiziksel", href: "/sunucu/fiziksel", cartCategory: "fiziksel" },
};

export type ServerCatalog = Record<ServerFamilyKey, ProductWithPricing[]>;

/** All four server families (same DAL call each page already used). */
export async function getServerCatalog(): Promise<ServerCatalog> {
  const [vps, vds, bulut, fiziksel] = await Promise.all([
    getProductsBySubType("vps"),
    getProductsBySubType("vds"),
    getProductsBySubType("cloud"),
    getProductsBySubType("server"),
  ]);
  return { vps, vds, bulut, fiziksel };
}

/* ------------------------------------------------------------------ */

type Res = Record<string, string | undefined>;
interface FeatureItem {
  label: string;
  value: string;
}

const res = (p: ProductWithPricing) => (p.resourceLimits as unknown as Res | null) ?? {};
const feats = (p: ProductWithPricing) => (p.features as unknown as FeatureItem[] | null) ?? [];
const included = (p: ProductWithPricing) => (p.includedFeatures as unknown as string[] | null) ?? [];

function monthlyOf(p: ProductWithPricing) {
  const m = p.pricingTiers.find((t) => t.period === "monthly");
  return toNumber(m?.discountedPrice ?? m?.price ?? p.basePrice);
}
function yearlyMonthlyOf(p: ProductWithPricing) {
  const y = p.pricingTiers.find((t) => t.period === "yearly");
  return y ? toNumber(y.discountedPrice ?? y.price) : null;
}

export { isUnverifiedClaim } from "@/lib/catalog/package-comparison";

const num = (s?: string) => {
  const m = s?.match(/(\d+(?:[.,]\d+)?)/);
  return m ? Number(m[1].replace(",", ".")) : NaN;
};
const strip = (s: string | undefined, word: string) => (s ?? "").replace(word, "").trim();
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];

function range(values: string[], unit = "") {
  const list = uniq(values);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  const first = list[0];
  const last = list[list.length - 1];
  if (unit && first.endsWith(unit) && last.endsWith(unit)) {
    return `${strip(first, unit)}–${strip(last, unit)} ${unit}`;
  }
  return `${first} – ${last}`;
}

function suffixOf(p: ProductWithPricing, label: RegExp) {
  const value = feats(p).find((f) => label.test(f.label))?.value ?? "";
  const parts = value.split(" ");
  return parts[parts.length - 1] ?? "";
}

export interface FamilySummary {
  key: ServerFamilyKey;
  label: string;
  href: string;
  count: number;
  startingPrice: number | null;
  cpuModel: string;
  cpu: string;
  ram: string;
  ramType: string;
  disk: string;
  diskType: string;
  port: string;
  traffic: string;
  hasConsole: boolean;
  freeSetup: boolean;
}

function cpuModel(key: ServerFamilyKey, products: ProductWithPricing[]) {
  if (key === "fiziksel") {
    const series = uniq(
      products.map((p) => res(p).cpu?.match(/Xeon\s+([A-Za-z]+)/)?.[1] ?? "")
    );
    return series.length ? `Intel Xeon ${series.join(" / ")}` : "";
  }
  const model = products
    .flatMap(included)
    .find((f) => /platinum|xeon|epyc|ryzen/i.test(f));
  if (!model) return "";
  return /intel|amd/i.test(model) ? model : /epyc|ryzen/i.test(model) ? `AMD ${model.replace(/^AMD\s*/i, "")}` : `Intel ${model}`;
}

export function summarizeFamily(key: ServerFamilyKey, products: ProductWithPricing[]): FamilySummary {
  const meta = serverFamilyMeta[key];
  const sorted = [...products].sort((a, b) => monthlyOf(a) - monthlyOf(b));
  const physical = key === "fiziksel";

  const cpu = physical
    ? range(sorted.map((p) => (res(p).cores ? `${num(res(p).cores)} çekirdek` : "")), "çekirdek")
    : range(sorted.map((p) => res(p).cpu ?? ""), "vCPU");

  return {
    key,
    label: meta.label,
    href: meta.href,
    count: products.length,
    startingPrice: sorted.length ? monthlyOf(sorted[0]) : null,
    cpuModel: cpuModel(key, sorted),
    cpu,
    ram: range(sorted.map((p) => res(p).ram ?? ""), "GB"),
    ramType: uniq(sorted.map((p) => suffixOf(p, /ram|bellek/i))).join(" / "),
    disk: range(sorted.map((p) => res(p).disk ?? ""), "GB"),
    diskType: uniq(sorted.map((p) => suffixOf(p, /disk/i))).join(" / "),
    port: range(sorted.map((p) => strip(res(p).port, "Port")), "Gbps"),
    traffic: range(sorted.map((p) => strip(res(p).traffic ?? res(p).bandwidth, "Trafik")), "TB"),
    hasConsole: sorted.some((p) => included(p).some((f) => /ipmi|kvm/i.test(f))),
    freeSetup: sorted.some((p) => included(p).some((f) => /ücretsiz kurulum/i.test(f))),
  };
}

export function summarizeCatalog(catalog: ServerCatalog): FamilySummary[] {
  return serverFamilyOrder.map((key) => summarizeFamily(key, catalog[key]));
}

/** DB product -> cart table row (prices are VAT-exclusive). */
export function productToCartRow(p: ProductWithPricing): CartPlanRow {
  const r = res(p);
  return {
    id: p.sku,
    name: p.name,
    featured: p.isPopular,
    specs: {
      cpu: r.cpu ?? "",
      cores: r.cores ?? "",
      ram: r.ram ? `${r.ram}${suffixOf(p, /ram|bellek/i) ? ` ${suffixOf(p, /ram|bellek/i)}` : ""}` : "",
      disk: r.disk ? `${r.disk}${suffixOf(p, /disk/i) ? ` ${suffixOf(p, /disk/i)}` : ""}` : "",
      port: strip(r.port, "Port"),
      traffic: strip(r.traffic ?? r.bandwidth, "Trafik"),
    },
    monthlyPrice: monthlyOf(p),
    yearlyMonthlyPrice: yearlyMonthlyOf(p),
  };
}

/** Features shared by every plan in a family (from `includedFeatures`), minus SLA claims. */
export function sharedIncluded(products: ProductWithPricing[]): string[] {
  if (products.length === 0) return [];
  const [first, ...rest] = products.map(included);
  return first.filter((f) => !isUnverifiedClaim(f) && rest.every((list) => list.includes(f)));
}
