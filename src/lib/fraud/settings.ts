import { getSettingMap, isEnabled } from "@/lib/integrations/settings";
import { DEFAULT_FRAUD_CONFIG, DEFAULT_RULE_WEIGHTS, FRAUD_RULE_IDS, type FraudConfig, type FraudRuleId } from "./rules";

/** Setting keys (Siparişler → İnceleme → Ayarlar). */
export const FRAUD_SETTING_KEYS = {
  enabled: "fraud_enabled",
  reviewThreshold: "fraud_review_threshold",
  blockThreshold: "fraud_block_threshold",
  sameIpLimit: "fraud_same_ip_limit",
  trustCfHeader: "fraud_trust_cf_header",
} as const;

export function ruleWeightSettingKey(rule: FraudRuleId) {
  return `fraud_weight_${rule}`;
}

function intSetting(value: string | undefined, fallback: number, min = 0, max = 1000) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Pure: raw setting values → config (defaults for missing / invalid values). */
export function parseFraudConfig(values: Record<string, string | undefined>): FraudConfig {
  const weights = Object.fromEntries(
    FRAUD_RULE_IDS.map((rule) => [rule, intSetting(values[ruleWeightSettingKey(rule)], DEFAULT_RULE_WEIGHTS[rule], 0, 100)])
  ) as Record<FraudRuleId, number>;
  const enabledRaw = values[FRAUD_SETTING_KEYS.enabled]?.trim();
  const trustRaw = values[FRAUD_SETTING_KEYS.trustCfHeader]?.trim();
  return {
    enabled: enabledRaw ? isEnabled(enabledRaw) : DEFAULT_FRAUD_CONFIG.enabled,
    reviewThreshold: intSetting(values[FRAUD_SETTING_KEYS.reviewThreshold], DEFAULT_FRAUD_CONFIG.reviewThreshold, 1),
    blockThreshold: intSetting(values[FRAUD_SETTING_KEYS.blockThreshold], DEFAULT_FRAUD_CONFIG.blockThreshold),
    sameIpLimit: intSetting(values[FRAUD_SETTING_KEYS.sameIpLimit], DEFAULT_FRAUD_CONFIG.sameIpLimit, 0, 100),
    trustCfHeader: trustRaw ? isEnabled(trustRaw) : DEFAULT_FRAUD_CONFIG.trustCfHeader,
    weights,
  };
}

export function fraudSettingKeys(): string[] {
  return [...Object.values(FRAUD_SETTING_KEYS), ...FRAUD_RULE_IDS.map(ruleWeightSettingKey)];
}

export async function getFraudConfig(): Promise<FraudConfig> {
  const values = await getSettingMap(fraudSettingKeys().map((key) => ({ key })));
  return parseFraudConfig(values);
}
