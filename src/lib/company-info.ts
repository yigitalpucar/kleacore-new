import type { Prisma } from "@prisma/client";

/**
 * The seller/company identity shown to customers: site footer, legal pages,
 * contracts (Ön Bilgilendirme / Mesafeli Satış) and e-mail footers. One
 * source so they can't disagree.
 *
 * Until the owner provides the Turkish invoicing company, the defaults are
 * the company on the published site footer. Admin settings override them
 * (`company_name`, `legal_seller_address` / `company_address`,
 * `company_phone`, `support_email` / `company_email`, `legal_seller_tax_id`,
 * `site_url`), except for known placeholder values, which count as unset.
 * Pure module apart from `loadCompanyInfo` (safe to import in client code).
 */
export const COMPANY_INFO_DEFAULTS = {
  name: "KLEAWORK DIGITAL LLC",
  addressLines: ["30 N Gould St Ste R", "Sheridan, WY 82801, USA"],
  address: "30 N Gould St Ste R, Sheridan, WY 82801, USA",
  email: "support@kleacore.com",
  taxId: "EIN 36-5157418",
  website: "https://kleacore.com",
} as const;

/**
 * Values seeded by scripts/configure-production-settings.mjs before real
 * data existed. They must never reach a contract or an e-mail footer.
 */
const PLACEHOLDER_VALUES: Record<"phone" | "address", ReadonlySet<string>> = {
  phone: new Set(["+908500000000", "08500000000", "8500000000"]),
  address: new Set(["istanbul, türkiye", "istanbul, turkiye", "i̇stanbul, türkiye"]),
};

function normalize(kind: "phone" | "address", value: string) {
  return kind === "phone" ? value.replace(/[^\d+]/g, "") : value.trim().toLocaleLowerCase("tr-TR");
}

export function isPlaceholderCompanyValue(kind: "phone" | "address", value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 && PLACEHOLDER_VALUES[kind].has(normalize(kind, trimmed));
}

/** A real configured value, or "" for empty / placeholder values. */
export function realCompanyValue(kind: "phone" | "address", value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return isPlaceholderCompanyValue(kind, trimmed) ? "" : trimmed;
}

export interface CompanyInfo {
  name: string;
  address: string;
  /** "" when no real phone number is configured: render no phone at all. */
  phone: string;
  email: string;
  taxId: string;
  website: string;
}

export const COMPANY_SETTING_KEYS = [
  "company_name",
  "company_address",
  "company_phone",
  "company_email",
  "support_email",
  "legal_seller_address",
  "legal_seller_tax_id",
  "site_url",
] as const;

export function companyInfoFromSettings(settings: Partial<Record<string, string | null | undefined>>): CompanyInfo {
  const get = (key: string) => settings[key]?.trim() || "";
  return {
    name: get("company_name") || COMPANY_INFO_DEFAULTS.name,
    address:
      realCompanyValue("address", get("legal_seller_address")) ||
      realCompanyValue("address", get("company_address")) ||
      COMPANY_INFO_DEFAULTS.address,
    phone: realCompanyValue("phone", get("company_phone")),
    email: get("support_email") || get("company_email") || COMPANY_INFO_DEFAULTS.email,
    taxId: get("legal_seller_tax_id") || COMPANY_INFO_DEFAULTS.taxId,
    website: get("site_url") || COMPANY_INFO_DEFAULTS.website,
  };
}

type SettingsClient = { setting: Pick<Prisma.TransactionClient["setting"], "findMany"> };

export async function loadCompanyInfo(client?: SettingsClient): Promise<CompanyInfo> {
  const source = client ?? (await import("@/lib/db")).db;
  const rows = await source.setting.findMany({
    where: { key: { in: [...COMPANY_SETTING_KEYS] } },
    select: { key: true, value: true },
  });
  return companyInfoFromSettings(Object.fromEntries(rows.map((row) => [row.key, row.value])));
}
