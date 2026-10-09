/**
 * Order risk rules (Faz 4, docs/fraud-kyc.md). Pure: the signals are
 * collected by ./evaluate.ts, the weights and thresholds come from settings
 * (./settings.ts). Every rule adds its weight when it matches; the total is
 * compared with the review threshold (order waits for staff) and the
 * optional block threshold (no payment until approved).
 */

export const FRAUD_RULE_IDS = [
  "first_order_server",
  "ip_country_foreign",
  "card_country_foreign",
  "disposable_email",
  "ip_velocity",
  "name_mismatch",
  "new_account",
] as const;

export type FraudRuleId = (typeof FRAUD_RULE_IDS)[number];

export const FRAUD_RULE_LABELS: Record<FraudRuleId, string> = {
  first_order_server: "İlk sipariş sunucu (VDS/sunucu)",
  ip_country_foreign: "IP ülkesi Türkiye dışı",
  card_country_foreign: "Kart (BIN) ülkesi Türkiye dışı",
  disposable_email: "Geçici (tek kullanımlık) e-posta alan adı",
  ip_velocity: "Aynı IP'den 24 saatte çok sayıda sipariş",
  name_mismatch: "Fatura adı ile kart sahibi farklı",
  new_account: "Hesap 1 günden yeni",
};

export const DEFAULT_RULE_WEIGHTS: Record<FraudRuleId, number> = {
  first_order_server: 30,
  ip_country_foreign: 25,
  card_country_foreign: 25,
  disposable_email: 40,
  ip_velocity: 20,
  name_mismatch: 20,
  new_account: 15,
};

/** Categories treated as "server" by first_order_server. */
export const SERVER_CATEGORY_SLUGS = ["vds", "vps", "server", "cloud", "datacenter"] as const;

export const HOME_COUNTRY = "TR";

export interface FraudConfig {
  enabled: boolean;
  /** Score ≥ this → İnceleme bekliyor. */
  reviewThreshold: number;
  /** Score ≥ this → payment refused until approved; 0 = never block. */
  blockThreshold: number;
  weights: Record<FraudRuleId, number>;
  /** ip_velocity matches when this many other orders came from the IP in 24 h. */
  sameIpLimit: number;
  /** Use Cloudflare's CF-IPCountry header (proxied host) before the offline DB. */
  trustCfHeader: boolean;
}

export const DEFAULT_FRAUD_CONFIG: FraudConfig = {
  enabled: true,
  reviewThreshold: 50,
  // Owner decision (Faz 4): orders scoring ≥ 80 cannot be paid until a staff
  // member approves the review. 0 turns blocking off.
  blockThreshold: 80,
  weights: DEFAULT_RULE_WEIGHTS,
  sameIpLimit: 3,
  trustCfHeader: true,
};

/** What the rules look at. `undefined` / null = unknown: the rule does not match. */
export interface FraudSignals {
  categorySlug: string;
  /** Orders of the customer before this checkout (not cancelled). */
  previousOrders: number;
  ipCountry?: string | null;
  cardCountry?: string | null;
  emailDomain?: string | null;
  disposableEmail?: boolean;
  /** Other orders from the same IP in the last 24 h. */
  sameIpOrders24h?: number;
  billingNames?: string[];
  cardHolderName?: string | null;
  accountAgeMs?: number | null;
}

export interface FraudRuleResult {
  rule: FraudRuleId;
  label: string;
  weight: number;
  matched: boolean;
  detail?: string;
}

export interface FraudScore {
  score: number;
  results: FraudRuleResult[];
  review: boolean;
  block: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeCountry(value: string | null | undefined) {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z][A-Z0-9]$/.test(code) && code !== "XX" ? code : null;
}

/** Lowercase ASCII-folded name tokens ("Çağrı Öztürk" → ["cagri", "ozturk"]). */
export function nameTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  const folded = value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  return folded.split(/\s+/).filter((token) => token.length >= 2);
}

/**
 * True when the card holder shares no name token with any billing name
 * (person or company). Unknown holder → false (nothing to compare).
 */
export function namesMismatch(billingNames: string[] | undefined, holder: string | null | undefined) {
  const holderTokens = nameTokens(holder);
  if (holderTokens.length === 0) return false;
  const billing = new Set((billingNames ?? []).flatMap(nameTokens));
  if (billing.size === 0) return false;
  return !holderTokens.some((token) => billing.has(token));
}

function ruleMatch(rule: FraudRuleId, signals: FraudSignals, config: FraudConfig): { matched: boolean; detail?: string } {
  switch (rule) {
    case "first_order_server": {
      const server = (SERVER_CATEGORY_SLUGS as readonly string[]).includes(signals.categorySlug);
      return { matched: server && signals.previousOrders === 0, detail: server ? signals.categorySlug : undefined };
    }
    case "ip_country_foreign": {
      const country = normalizeCountry(signals.ipCountry);
      return { matched: country !== null && country !== HOME_COUNTRY, detail: country ?? "bilinmiyor" };
    }
    case "card_country_foreign": {
      const country = normalizeCountry(signals.cardCountry);
      return { matched: country !== null && country !== HOME_COUNTRY, detail: country ?? "bilinmiyor" };
    }
    case "disposable_email":
      return { matched: signals.disposableEmail === true, detail: signals.emailDomain ?? undefined };
    case "ip_velocity": {
      const count = signals.sameIpOrders24h;
      return {
        matched: typeof count === "number" && config.sameIpLimit > 0 && count >= config.sameIpLimit,
        detail: typeof count === "number" ? `${count} sipariş` : undefined,
      };
    }
    case "name_mismatch":
      return {
        matched: namesMismatch(signals.billingNames, signals.cardHolderName),
        detail: signals.cardHolderName ? "kart sahibi adı karşılaştırıldı" : "kart sahibi bilinmiyor",
      };
    case "new_account": {
      const age = signals.accountAgeMs;
      return {
        matched: typeof age === "number" && age >= 0 && age < DAY_MS,
        detail: typeof age === "number" ? `${Math.floor(age / 3_600_000)} saat` : undefined,
      };
    }
  }
}

export function evaluateRules(signals: FraudSignals, config: FraudConfig = DEFAULT_FRAUD_CONFIG): FraudRuleResult[] {
  return FRAUD_RULE_IDS.map((rule) => {
    const weight = Math.max(0, Math.round(config.weights[rule] ?? 0));
    const { matched, detail } = ruleMatch(rule, signals, config);
    return { rule, label: FRAUD_RULE_LABELS[rule], weight, matched: matched && weight > 0, detail };
  });
}

/** Total of the matched weights and the threshold decisions. */
export function scoreResults(results: FraudRuleResult[], config: FraudConfig = DEFAULT_FRAUD_CONFIG): FraudScore {
  const score = results.reduce((total, result) => total + (result.matched ? result.weight : 0), 0);
  const review = config.enabled && config.reviewThreshold > 0 && score >= config.reviewThreshold;
  const block = review && config.blockThreshold > 0 && score >= config.blockThreshold;
  return { score, results, review, block };
}

export function scoreSignals(signals: FraudSignals, config: FraudConfig = DEFAULT_FRAUD_CONFIG): FraudScore {
  return scoreResults(evaluateRules(signals, config), config);
}

/**
 * Payment stage: replaces the card rules of a stored checkout breakdown with
 * the ones computed from the card data the gateway reported. Rules missing
 * from an older breakdown are added.
 */
export function mergeRuleResults(previous: unknown, replacements: FraudRuleResult[]): FraudRuleResult[] {
  const stored = parseRuleResults(previous);
  const byRule = new Map(stored.map((result) => [result.rule, result]));
  for (const replacement of replacements) byRule.set(replacement.rule, replacement);
  return FRAUD_RULE_IDS.flatMap((rule) => {
    const result = byRule.get(rule);
    return result ? [result] : [];
  });
}

/** FraudCheck.rules JSON → typed results (unknown entries dropped). */
export function parseRuleResults(value: unknown): FraudRuleResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (!(FRAUD_RULE_IDS as readonly string[]).includes(String(record.rule))) return [];
    const rule = record.rule as FraudRuleId;
    return [
      {
        rule,
        label: typeof record.label === "string" ? record.label : FRAUD_RULE_LABELS[rule],
        weight: Number(record.weight) || 0,
        matched: record.matched === true,
        detail: typeof record.detail === "string" ? record.detail : undefined,
      },
    ];
  });
}
