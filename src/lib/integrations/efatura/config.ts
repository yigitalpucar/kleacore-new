import { getSettingMap, isEnabled } from "../settings";
import { createDisabledEInvoiceProvider } from "./providers/disabled";
import { createParasutEInvoiceProvider } from "./providers/parasut";
import { createUyumsoftEInvoiceProvider } from "./providers/uyumsoft";
import type {
  EFaturaProfile,
  EInvoiceConfig,
  EInvoiceProvider,
  EInvoiceProviderName,
} from "./types";

export const EFATURA_SETTING_KEYS = [
  { key: "efatura_enabled", fallback: "false" },
  { key: "efatura_provider", fallback: "uyumsoft" },
  { key: "efatura_api_key" },
  { key: "efatura_company_vkn" },
  { key: "efatura_default_profile", fallback: "TEMELFATURA" },
  { key: "efatura_uyumsoft_username" },
  { key: "efatura_uyumsoft_password" },
  { key: "efatura_uyumsoft_test_mode", fallback: "true" },
  { key: "efatura_uyumsoft_earsiv_prefix" },
  { key: "efatura_uyumsoft_efatura_prefix" },
  { key: "efatura_company_name" },
  { key: "efatura_company_tax_office" },
  { key: "efatura_company_street" },
  { key: "efatura_company_district" },
  { key: "efatura_company_city" },
  { key: "efatura_company_postal_zone" },
  { key: "efatura_company_phone" },
  { key: "efatura_company_email" },
  { key: "efatura_company_website" },
  { key: "efatura_company_mersis" },
  // General company settings used as fallbacks for the supplier party.
  { key: "company_name" },
  { key: "company_email" },
  { key: "company_phone" },
  { key: "company_address" },
  { key: "address" },
  { key: "site_url" },
] as const;

export function normalizeProvider(value: string | undefined): EInvoiceProviderName {
  if (value === "uyumsoft" || value === "parasut") {
    return value;
  }
  return "disabled";
}

export function normalizeProfile(value: string | undefined): EFaturaProfile {
  return value === "TICARIFATURA" ? "TICARIFATURA" : "TEMELFATURA";
}

/** Series prefixes are exactly three uppercase letters/digits (GİB numbering). */
export function normalizePrefix(value: string | undefined): string {
  const prefix = (value ?? "").trim().toLocaleUpperCase("tr-TR");
  return /^[A-Z0-9]{3}$/.test(prefix) ? prefix : "";
}

export function configFromSettings(settings: Record<string, string>): EInvoiceConfig {
  const pick = (...keys: string[]) => keys.map((key) => settings[key]?.trim()).find(Boolean) ?? "";

  return {
    enabled: isEnabled(settings.efatura_enabled),
    provider: normalizeProvider(settings.efatura_provider),
    apiKey: settings.efatura_api_key ?? "",
    companyVkn: (settings.efatura_company_vkn ?? "").replace(/\D/g, ""),
    defaultProfile: normalizeProfile(settings.efatura_default_profile),
    uyumsoft: {
      username: settings.efatura_uyumsoft_username?.trim() ?? "",
      password: settings.efatura_uyumsoft_password ?? "",
      testMode: settings.efatura_uyumsoft_test_mode !== "false",
      earsivPrefix: normalizePrefix(settings.efatura_uyumsoft_earsiv_prefix),
      efaturaPrefix: normalizePrefix(settings.efatura_uyumsoft_efatura_prefix),
    },
    supplier: {
      name: pick("efatura_company_name", "company_name"),
      vkn: (settings.efatura_company_vkn ?? "").replace(/\D/g, ""),
      taxOffice: pick("efatura_company_tax_office"),
      street: pick("efatura_company_street", "company_address", "address"),
      district: pick("efatura_company_district"),
      city: pick("efatura_company_city") || "İstanbul",
      postalZone: pick("efatura_company_postal_zone"),
      country: "Türkiye",
      phone: pick("efatura_company_phone", "company_phone"),
      email: pick("efatura_company_email", "company_email"),
      website: pick("efatura_company_website", "site_url"),
      mersisNo: pick("efatura_company_mersis") || undefined,
    },
  };
}

export async function getEInvoiceConfig(): Promise<EInvoiceConfig> {
  return configFromSettings(await getSettingMap([...EFATURA_SETTING_KEYS]));
}

/** Why the module can't issue yet (Turkish, for the admin UI), or null when ready. */
export function getEInvoiceConfigProblem(config: EInvoiceConfig): string | null {
  if (!config.enabled || config.provider === "disabled") return "E-fatura modülü pasif.";
  if (!/^\d{10,11}$/.test(config.companyVkn)) return "Şirket VKN/TCKN girilmemiş.";
  if (config.provider === "uyumsoft") {
    if (!config.uyumsoft.username || !config.uyumsoft.password) return "Uyumsoft kullanıcı adı/şifresi eksik.";
    if (!config.supplier.name || !config.supplier.taxOffice) return "Şirket unvanı veya vergi dairesi eksik.";
  }
  if (config.provider === "parasut" && !config.apiKey.trim()) return "Paraşüt kimlik bilgileri eksik.";
  return null;
}

export function isEInvoiceConfigured(config: EInvoiceConfig): boolean {
  return getEInvoiceConfigProblem(config) === null;
}

/** Provider by name, regardless of the enabled flag (records keep their provider). */
export function createEInvoiceProvider(name: EInvoiceProviderName, config: EInvoiceConfig): EInvoiceProvider {
  if (name === "uyumsoft") {
    return createUyumsoftEInvoiceProvider({
      username: config.uyumsoft.username,
      password: config.uyumsoft.password,
      testMode: config.uyumsoft.testMode,
    });
  }
  if (name === "parasut" && config.apiKey.trim()) {
    return createParasutEInvoiceProvider(config.apiKey);
  }
  return createDisabledEInvoiceProvider();
}

export async function getEInvoiceProvider(): Promise<EInvoiceProvider> {
  const config = await getEInvoiceConfig();
  if (!config.enabled) {
    return createDisabledEInvoiceProvider();
  }
  return createEInvoiceProvider(config.provider, config);
}
