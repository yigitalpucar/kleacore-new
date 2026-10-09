import { describe, expect, it } from "vitest";
import {
  DEFAULT_FRAUD_CONFIG,
  mergeRuleResults,
  namesMismatch,
  nameTokens,
  scoreSignals,
  type FraudConfig,
  type FraudSignals,
} from "./rules";
import { parseFraudConfig } from "./settings";
import { emailDomain, isDisposableEmailDomain } from "./disposable-domains";

const HOUR = 3_600_000;

const clean: FraudSignals = {
  categorySlug: "hosting",
  previousOrders: 2,
  ipCountry: "TR",
  emailDomain: "gmail.com",
  disposableEmail: false,
  sameIpOrders24h: 0,
  billingNames: ["Ayşe Yılmaz"],
  accountAgeMs: 400 * 24 * HOUR,
};

function matched(signals: FraudSignals, config: FraudConfig = DEFAULT_FRAUD_CONFIG) {
  return scoreSignals(signals, config).results.filter((r) => r.matched).map((r) => r.rule);
}

describe("fraud rule scoring", () => {
  it("scores a returning Turkish customer 0", () => {
    const scored = scoreSignals(clean);
    expect(scored).toMatchObject({ score: 0, review: false, block: false });
  });

  it("matches each rule on its signal and adds its weight", () => {
    expect(matched({ ...clean, categorySlug: "vds", previousOrders: 0 })).toEqual(["first_order_server"]);
    expect(matched({ ...clean, categorySlug: "vds", previousOrders: 1 })).toEqual([]);
    expect(matched({ ...clean, categorySlug: "hosting", previousOrders: 0 })).toEqual([]);
    expect(matched({ ...clean, ipCountry: "DE" })).toEqual(["ip_country_foreign"]);
    expect(matched({ ...clean, ipCountry: "T1" })).toEqual(["ip_country_foreign"]); // Tor
    expect(matched({ ...clean, ipCountry: "XX" })).toEqual([]); // unknown
    expect(matched({ ...clean, ipCountry: null })).toEqual([]);
    expect(matched({ ...clean, cardCountry: "us" })).toEqual(["card_country_foreign"]);
    expect(matched({ ...clean, disposableEmail: true })).toEqual(["disposable_email"]);
    expect(matched({ ...clean, sameIpOrders24h: 3 })).toEqual(["ip_velocity"]);
    expect(matched({ ...clean, sameIpOrders24h: 2 })).toEqual([]);
    expect(matched({ ...clean, cardHolderName: "John Smith" })).toEqual(["name_mismatch"]);
    expect(matched({ ...clean, cardHolderName: "AYSE YILMAZ" })).toEqual([]);
    expect(matched({ ...clean, accountAgeMs: 2 * HOUR })).toEqual(["new_account"]);
    expect(matched({ ...clean, accountAgeMs: 30 * HOUR })).toEqual([]);

    expect(scoreSignals({ ...clean, disposableEmail: true, accountAgeMs: HOUR }).score).toBe(40 + 15);
  });

  it("puts the roadmap case (first VDS order from abroad) into review, but not one signal alone", () => {
    const vdsAbroad = scoreSignals({ ...clean, categorySlug: "vds", previousOrders: 0, ipCountry: "NL" });
    expect(vdsAbroad).toMatchObject({ score: 55, review: true, block: false });

    expect(scoreSignals({ ...clean, categorySlug: "vds", previousOrders: 0 }).review).toBe(false);
    expect(scoreSignals({ ...clean, ipCountry: "NL" }).review).toBe(false);
  });

  it("defaults: review at 50, payment block at 80 (owner decision)", () => {
    expect(DEFAULT_FRAUD_CONFIG.reviewThreshold).toBe(50);
    expect(DEFAULT_FRAUD_CONFIG.blockThreshold).toBe(80);
  });

  it("applies the review threshold inclusively and the block threshold only when set", () => {
    const config: FraudConfig = { ...DEFAULT_FRAUD_CONFIG, reviewThreshold: 40, blockThreshold: 0 };
    expect(scoreSignals({ ...clean, disposableEmail: true }, config)).toMatchObject({ score: 40, review: true, block: false });
    expect(scoreSignals({ ...clean, disposableEmail: false, ipCountry: "DE" }, config).review).toBe(false);

    const blocking: FraudConfig = { ...config, blockThreshold: 60 };
    expect(scoreSignals({ ...clean, disposableEmail: true }, blocking).block).toBe(false);
    expect(scoreSignals({ ...clean, disposableEmail: true, ipCountry: "DE" }, blocking)).toMatchObject({ score: 65, block: true });
  });

  it("never reviews when disabled, and weight 0 switches a rule off", () => {
    const off = { ...DEFAULT_FRAUD_CONFIG, enabled: false };
    expect(scoreSignals({ ...clean, disposableEmail: true, ipCountry: "DE" }, off).review).toBe(false);

    const noEmailRule = { ...DEFAULT_FRAUD_CONFIG, weights: { ...DEFAULT_FRAUD_CONFIG.weights, disposable_email: 0 } };
    expect(matched({ ...clean, disposableEmail: true }, noEmailRule)).toEqual([]);
  });

  it("merges payment-stage card rules into the stored checkout breakdown", () => {
    const checkout = scoreSignals({ ...clean, categorySlug: "vds", previousOrders: 0 }).results;
    const card = scoreSignals({ ...clean, cardCountry: "GB", cardHolderName: "John Smith" }).results.filter(
      (r) => r.rule === "card_country_foreign" || r.rule === "name_mismatch"
    );
    const merged = mergeRuleResults(JSON.parse(JSON.stringify(checkout)), card);
    expect(merged).toHaveLength(checkout.length);
    expect(merged.filter((r) => r.matched).map((r) => r.rule).sort()).toEqual(
      ["card_country_foreign", "first_order_server", "name_mismatch"].sort()
    );
    expect(mergeRuleResults("garbage", card)).toHaveLength(2);
  });
});

describe("name comparison", () => {
  it("folds Turkish characters and ignores case / punctuation", () => {
    expect(nameTokens("Çağrı ÖZTÜRK-İnce")).toEqual(["cagri", "ozturk", "ince"]);
    expect(namesMismatch(["Çağrı Öztürk"], "CAGRI OZTURK")).toBe(false);
    expect(namesMismatch(["Ayşe Yılmaz", "Kleawork Bilişim"], "KLEAWORK BILISIM LTD")).toBe(false);
    expect(namesMismatch(["Ayşe Yılmaz"], "Mehmet Demir")).toBe(true);
    expect(namesMismatch(["Ayşe Yılmaz"], "")).toBe(false);
    expect(namesMismatch([], "Mehmet Demir")).toBe(false);
  });
});

describe("disposable e-mail domains", () => {
  it("matches listed domains and their subdomains only", () => {
    expect(emailDomain("Foo@Mailinator.com")).toBe("mailinator.com");
    expect(isDisposableEmailDomain("mailinator.com")).toBe(true);
    expect(isDisposableEmailDomain("x.yopmail.com")).toBe(true);
    expect(isDisposableEmailDomain("gmail.com")).toBe(false);
    expect(isDisposableEmailDomain("notmailinator.com")).toBe(false);
    expect(isDisposableEmailDomain(null)).toBe(false);
  });
});

describe("fraud settings", () => {
  it("falls back to defaults for missing or invalid values and clamps", () => {
    const config = parseFraudConfig({
      fraud_review_threshold: "abc",
      fraud_block_threshold: "80",
      fraud_weight_disposable_email: "500",
      fraud_weight_new_account: "0",
      fraud_enabled: "false",
      fraud_trust_cf_header: "",
    });
    expect(config).toMatchObject({ enabled: false, reviewThreshold: 50, blockThreshold: 80, trustCfHeader: true });
    expect(config.weights.disposable_email).toBe(100);
    expect(config.weights.new_account).toBe(0);
    expect(config.weights.first_order_server).toBe(30);
  });
});
