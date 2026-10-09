import { getSettingMap } from "@/lib/integrations/settings";

export const KYC_SETTING_KEYS = {
  requiredCategories: "kyc_required_categories",
  rejectedRetentionDays: "kyc_rejected_retention_days",
  approvedRetentionDaysAfterServiceEnd: "kyc_approved_retention_days_after_service_end",
} as const;

/** Server products (5651: who operates a server must be identifiable). */
export const DEFAULT_KYC_CATEGORIES = "vds,server,datacenter";
export const DEFAULT_REJECTED_RETENTION_DAYS = 30;
/** Owner decision (Faz 4): approved document files go 2 years after the last server service ended. */
export const DEFAULT_APPROVED_RETENTION_DAYS_AFTER_SERVICE_END = 730;

export interface KycConfig {
  /** Category slugs whose provisioning waits for an APPROVED verification. */
  requiredCategories: string[];
  /** Days after a rejection until the rejected documents are deleted. */
  rejectedRetentionDays: number;
  /** Days after the customer's last KYC-category service ended until approved document files are deleted. */
  approvedRetentionDaysAfterServiceEnd: number;
}

export function parseCategoryList(value: string | undefined | null): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(/[\s,;]+/)
        .map((slug) => slug.trim().toLowerCase())
        .filter((slug) => /^[a-z0-9_-]+$/.test(slug))
    ),
  ];
}

/** Pure: raw settings → config. An explicit "-" (or "yok") turns the requirement off. */
export function parseKycConfig(values: Record<string, string | undefined>): KycConfig {
  const rawCategories = values[KYC_SETTING_KEYS.requiredCategories]?.trim();
  const requiredCategories =
    rawCategories === "-" || rawCategories?.toLowerCase() === "yok"
      ? []
      : parseCategoryList(rawCategories || DEFAULT_KYC_CATEGORIES);
  const days = Number(values[KYC_SETTING_KEYS.rejectedRetentionDays]?.trim() || DEFAULT_REJECTED_RETENTION_DAYS);
  const approvedDays = Number(
    values[KYC_SETTING_KEYS.approvedRetentionDaysAfterServiceEnd]?.trim() || DEFAULT_APPROVED_RETENTION_DAYS_AFTER_SERVICE_END
  );
  return {
    requiredCategories,
    rejectedRetentionDays: Number.isInteger(days) && days >= 0 && days <= 3650 ? days : DEFAULT_REJECTED_RETENTION_DAYS,
    approvedRetentionDaysAfterServiceEnd:
      Number.isInteger(approvedDays) && approvedDays >= 0 && approvedDays <= 3650
        ? approvedDays
        : DEFAULT_APPROVED_RETENTION_DAYS_AFTER_SERVICE_END,
  };
}

export async function getKycConfig(): Promise<KycConfig> {
  const values = await getSettingMap(Object.values(KYC_SETTING_KEYS).map((key) => ({ key })));
  return parseKycConfig(values);
}

export function categoryRequiresKyc(config: KycConfig, categorySlug: string) {
  return config.requiredCategories.includes(categorySlug.toLowerCase());
}
