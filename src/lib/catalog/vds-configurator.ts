/**
 * VDS configurator model (pure; used by the /sunucu/vds configurator).
 *
 * VDS products carry no CPU/RAM/disk configurable options in the DB, so the
 * resource sliders snap to the real packages: every slider stop is a value
 * some package actually has, and moving a slider selects the cheapest
 * package that offers at least that much. Extra choices (operating system,
 * add-ons) come from the selected package's `product_config_options`; the
 * price shown here is display only — checkout recomputes it from the DB.
 */
import type {
  ConfigurationSelections,
  ProductConfigOptionView,
} from "@/lib/products/configurator-types";
import { calculateConfigurationPrice } from "@/lib/products/configurator-pricing";
import { periodTotal } from "@/lib/billing/period-price";
import { add, toNumber } from "@/lib/money";
import type { BillingPeriod } from "@/lib/format/price";
import { packagePrices, type ComparableProduct } from "./package-comparison";

export type ResourceKey = "cpu" | "ram" | "disk";

export const RESOURCE_KEYS: ResourceKey[] = ["cpu", "ram", "disk"];

export interface VdsPlan {
  sku: string;
  slug: string;
  name: string;
  featured: boolean;
  monthlyPrice: number;
  yearlyMonthlyPrice: number | null;
  savingsPercent: number;
  /** Parsed numbers (vCPU, GB, GB); null when the record has no number. */
  resources: Record<ResourceKey, number | null>;
  /** Display strings straight from the DB record ("2 vCPU", "4 GB DDR4"…). */
  specs: { label: string; value: string }[];
  /** Active config options of this package (OS, add-ons). */
  options: ProductConfigOptionView[];
  /** Fixed OS label of a module-bound package (Proxmox `osLabel`), if any. */
  fixedOs: string | null;
}

/** First number in a DB string ("2 vCPU" → 2, "1,5 GB" → 1.5). */
export function firstNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** Plans whose three resources are all known, cheapest first. */
export function sliderPlans(plans: VdsPlan[]): VdsPlan[] {
  return plans
    .filter((plan) => RESOURCE_KEYS.every((key) => plan.resources[key] !== null))
    .sort((a, b) => a.monthlyPrice - b.monthlyPrice);
}

/** Distinct values of a resource across the plans, ascending (slider stops). */
export function resourceStops(plans: VdsPlan[], key: ResourceKey): number[] {
  const values = plans.map((plan) => plan.resources[key]).filter((v): v is number => v !== null);
  return [...new Set(values)].sort((a, b) => a - b);
}

/**
 * Cheapest plan offering at least `value` of `key`. Falls back to the plan
 * with the most of that resource when nothing reaches the value.
 */
export function planForResource(plans: VdsPlan[], key: ResourceKey, value: number): VdsPlan | undefined {
  const candidates = plans
    .filter((plan) => (plan.resources[key] ?? -Infinity) >= value)
    .sort((a, b) => a.monthlyPrice - b.monthlyPrice || (a.resources[key] ?? 0) - (b.resources[key] ?? 0));
  if (candidates[0]) return candidates[0];
  return [...plans].sort((a, b) => (b.resources[key] ?? 0) - (a.resources[key] ?? 0))[0];
}

/* ------------------------------------------------------------------ */
/* Operating system                                                    */

const OS_OPTION_SLUGS = new Set(["os", "isletim-sistemi", "operating-system", "işletim-sistemi"]);

/** The package's OS choice: a `select` option with an OS slug or name. */
export function findOsOption(options: ProductConfigOptionView[]): ProductConfigOptionView | undefined {
  return options.find(
    (option) =>
      option.optionType === "select" &&
      option.choices.length > 0 &&
      (OS_OPTION_SLUGS.has(option.slug.toLocaleLowerCase("tr")) || /işletim sistemi|operating system/.test(option.name.toLocaleLowerCase("tr")))
  );
}

export type OsFamily =
  | "ubuntu"
  | "debian"
  | "almalinux"
  | "rockylinux"
  | "centos"
  | "fedora"
  | "freebsd"
  | "redhat"
  | "opensuse"
  | "archlinux"
  | "windows"
  | "other";

const OS_PATTERNS: Array<[OsFamily, RegExp]> = [
  ["ubuntu", /ubuntu/i],
  ["debian", /debian/i],
  ["almalinux", /alma/i],
  ["rockylinux", /rocky/i],
  ["centos", /cent\s?os/i],
  ["fedora", /fedora/i],
  ["freebsd", /freebsd/i],
  ["redhat", /red\s?hat|rhel/i],
  ["opensuse", /suse/i],
  ["archlinux", /\barch/i],
  ["windows", /windows|win\s?server/i],
];

/** Logo family for an OS choice, from its value or label. */
export function osFamily(choice: { value: string; label: string }): OsFamily {
  const text = `${choice.value} ${choice.label}`;
  return OS_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}

/* ------------------------------------------------------------------ */
/* Selections + display quote                                          */

/** Default selections for a plan: first choice of required selects, min of required quantities. */
export function defaultSelections(
  options: ProductConfigOptionView[],
  previous: ConfigurationSelections = {}
): ConfigurationSelections {
  const next: ConfigurationSelections = {};
  for (const option of options) {
    const prev = previous[option.slug];
    if (option.optionType === "select") {
      const keep = prev !== undefined && option.choices.some((choice) => choice.value === String(prev));
      if (keep) next[option.slug] = String(prev);
      else if (option.isRequired && option.choices[0]) next[option.slug] = option.choices[0].value;
      continue;
    }
    const min = option.minValue ?? 0;
    const max = option.maxValue ?? Number.POSITIVE_INFINITY;
    if (typeof prev === "number" && Number.isInteger(prev) && prev >= min && prev <= max) next[option.slug] = prev;
    else if (option.isRequired) next[option.slug] = Math.max(min, 1);
  }
  return next;
}

export interface VdsQuote {
  period: BillingPeriod;
  /** Tier price as listed (monthly equivalent for yearly). */
  listedMonthly: number;
  /** Package charge for one billing period. */
  planTotal: number;
  options: { slug: string; name: string; label: string; price: number }[];
  optionsTotal: number;
  /** Pre-tax total for one billing period (display only). */
  total: number;
}

/**
 * What the cart will show for this configuration. Mirrors checkout's
 * getCatalogProduct (period total of the tier + config option period
 * prices) but the server recalculates; never send this as a price.
 */
export function quoteVds(plan: VdsPlan, period: BillingPeriod, selections: ConfigurationSelections): VdsQuote {
  const yearly = period === "yearly" && plan.yearlyMonthlyPrice !== null;
  const effective: BillingPeriod = yearly ? "yearly" : "monthly";
  const listedMonthly = yearly ? (plan.yearlyMonthlyPrice as number) : plan.monthlyPrice;
  const planTotal = periodTotal(listedMonthly, effective, "monthly-equivalent");
  const config = calculateConfigurationPrice(plan.options, selections, effective);
  return {
    period: effective,
    listedMonthly,
    planTotal,
    options: config.lines.map((line) => ({ slug: line.slug, name: line.name, label: line.label, price: line.price })),
    optionsTotal: config.total,
    total: toNumber(add(planTotal, config.total)),
  };
}

/* ------------------------------------------------------------------ */
/* DB record → VdsPlan                                                 */


interface VdsSource extends ComparableProduct {
  resourceLimits: unknown;
  moduleOptions?: unknown;
}

const RESOURCE_SOURCE: Record<ResourceKey, string[]> = {
  cpu: ["cpu", "cores"],
  ram: ["ram"],
  disk: ["disk", "storage"],
};

export function toVdsPlan(product: VdsSource, options: ProductConfigOptionView[] = []): VdsPlan {
  const limits =
    product.resourceLimits && typeof product.resourceLimits === "object"
      ? (product.resourceLimits as Record<string, unknown>)
      : {};
  const resources = Object.fromEntries(
    RESOURCE_KEYS.map((key) => {
      const raw = RESOURCE_SOURCE[key].map((field) => limits[field]).find((v) => typeof v === "string");
      return [key, firstNumber(raw)];
    })
  ) as Record<ResourceKey, number | null>;

  const specs = Array.isArray(product.features)
    ? (product.features as Array<{ label?: unknown; value?: unknown }>)
        .filter((f) => typeof f?.label === "string" && typeof f?.value === "string")
        .map((f) => ({ label: f.label as string, value: f.value as string }))
    : [];

  const moduleOptions =
    product.moduleOptions && typeof product.moduleOptions === "object"
      ? (product.moduleOptions as Record<string, unknown>)
      : {};
  const fixedOs = typeof moduleOptions.osLabel === "string" && moduleOptions.osLabel.trim() ? moduleOptions.osLabel.trim() : null;

  return {
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    featured: product.isPopular,
    ...packagePrices(product),
    resources,
    specs,
    options: options.filter((option) => option.isActive),
    fixedOs,
  };
}
