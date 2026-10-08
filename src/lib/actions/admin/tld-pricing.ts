"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { runCronWithLock } from "@/lib/cron/run-log";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { parseMoney } from "@/lib/money";
import { syncTcmbRates } from "@/lib/fx/sync";
import {
  ROUNDING_MODES,
  TLD_PRICING_RULES_KEY,
  applyTldSuggestedPrices,
  getTldPricingRules,
  type TldPricingRules,
} from "@/lib/fx/tld-pricing";
import { requirePermission } from "@/lib/utils/auth-helpers";

const log = createLogger("actions.admin.tld-pricing");
const PAGE_PATH = "/yonetim/urunler/tld-fiyatlari";

type ActionResult<T = object> = ({ success: true } & T) | { success: false; error: string };

const rulesInputSchema = z.object({
  marginPercent: z.string(),
  marginFixedTry: z.string(),
  rounding: z.enum(ROUNDING_MODES),
  autoApply: z.boolean(),
});

export async function saveTldPricingRulesAction(input: z.infer<typeof rulesInputSchema>): Promise<ActionResult> {
  const session = await requirePermission("products.manage");
  const parsed = rulesInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Geçersiz kural." };

  const percent = parseMoney(parsed.data.marginPercent || "0");
  const fixed = parseMoney(parsed.data.marginFixedTry || "0");
  if (!percent || percent.lt(0) || percent.gt(1000)) return { success: false, error: "Marj yüzdesi 0–1000 arasında olmalı." };
  if (!fixed || fixed.lt(0) || fixed.gt(100000)) return { success: false, error: "Sabit marj 0–100.000 ₺ arasında olmalı." };

  const previous = await getTldPricingRules();
  const rules: TldPricingRules = {
    marginPercent: percent.toDecimalPlaces(2).toNumber(),
    marginFixedTry: fixed.toDecimalPlaces(2).toNumber(),
    rounding: parsed.data.rounding,
    autoApply: parsed.data.autoApply,
    updatedBy: session.user.id,
    updatedAt: new Date().toISOString(),
  };

  await db.setting.upsert({
    where: { key: TLD_PRICING_RULES_KEY },
    create: {
      key: TLD_PRICING_RULES_KEY,
      group: "pricing",
      type: "json",
      label: "TLD fiyat marjı kuralı",
      value: JSON.stringify(rules),
    },
    update: { value: JSON.stringify(rules) },
  });

  await logActivity({
    userId: session.user.id,
    action: "tld.pricing_rules.updated",
    entity: "setting",
    entityId: TLD_PRICING_RULES_KEY,
    details: {
      before: {
        marginPercent: previous.marginPercent,
        marginFixedTry: previous.marginFixedTry,
        rounding: previous.rounding,
        autoApply: previous.autoApply,
      },
      after: {
        marginPercent: rules.marginPercent,
        marginFixedTry: rules.marginFixedTry,
        rounding: rules.rounding,
        autoApply: rules.autoApply,
      },
    },
  });

  revalidatePath(PAGE_PATH);
  return { success: true };
}

const COST_CURRENCIES = ["USD", "EUR", "GBP", "TRY"] as const;

const costInputSchema = z.object({
  id: z.string().min(1),
  costRegister: z.string(),
  costRenew: z.string(),
  costTransfer: z.string(),
  costCurrency: z.enum(COST_CURRENCIES),
});

function optionalCost(value: string) {
  const text = value.trim();
  if (!text) return { ok: true as const, value: null };
  const parsed = parseMoney(text);
  if (!parsed || parsed.lt(0) || parsed.gt(1_000_000)) return { ok: false as const };
  return { ok: true as const, value: parsed.isZero() ? null : parsed.toDecimalPlaces(4) };
}

export async function updateTldCostAction(input: z.infer<typeof costInputSchema>): Promise<ActionResult> {
  const session = await requirePermission("products.manage");
  const parsed = costInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Geçersiz maliyet." };

  const register = optionalCost(parsed.data.costRegister);
  const renew = optionalCost(parsed.data.costRenew);
  const transfer = optionalCost(parsed.data.costTransfer);
  if (!register.ok || !renew.ok || !transfer.ok) {
    return { success: false, error: "Maliyetler 0 veya pozitif bir sayı olmalı." };
  }

  const before = await db.domainTld.findUnique({
    where: { id: parsed.data.id },
    select: { ext: true, costRegister: true, costRenew: true, costTransfer: true, costCurrency: true },
  });
  if (!before) return { success: false, error: "TLD bulunamadı." };

  await db.domainTld.update({
    where: { id: parsed.data.id },
    data: {
      costRegister: register.value,
      costRenew: renew.value,
      costTransfer: transfer.value,
      costCurrency: parsed.data.costCurrency,
      costUpdatedAt: new Date(),
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "tld.cost.updated",
    entity: "domain_tld",
    entityId: parsed.data.id,
    details: {
      ext: before.ext,
      before: {
        currency: before.costCurrency,
        register: before.costRegister?.toString() ?? null,
        renew: before.costRenew?.toString() ?? null,
        transfer: before.costTransfer?.toString() ?? null,
      },
      after: {
        currency: parsed.data.costCurrency,
        register: register.value?.toString() ?? null,
        renew: renew.value?.toString() ?? null,
        transfer: transfer.value?.toString() ?? null,
      },
    },
  });

  revalidatePath(PAGE_PATH);
  return { success: true };
}

const applyInputSchema = z.object({
  tldIds: z.array(z.string().min(1)).max(1000).optional(),
  expectedRateDay: z.string().nullable(),
});

export async function applyTldSuggestionsAction(
  input: z.infer<typeof applyInputSchema>
): Promise<ActionResult<{ applied: number }>> {
  const session = await requirePermission("products.manage");
  const parsed = applyInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Geçersiz istek." };

  const outcome = await applyTldSuggestedPrices({
    tldIds: parsed.data.tldIds,
    actorId: session.user.id,
    source: "admin",
    expectedRateDay: parsed.data.expectedRateDay,
  });
  if (!outcome.ok) {
    return {
      success: false,
      error:
        outcome.error === "RATE_CHANGED"
          ? "Kur bu arada güncellendi. Sayfayı yenileyip yeni önerileri kontrol edin."
          : "Kayıtlı kur yok. Önce kurları güncelleyin.",
    };
  }

  revalidatePath(PAGE_PATH);
  revalidatePath("/domain/kayit");
  revalidatePath("/domain/transfer");
  return { success: true, applied: outcome.applied.length };
}

/** "Kurları şimdi güncelle": same lock/run log as the cron, without auto-apply. */
export async function syncFxRatesNowAction(): Promise<ActionResult<{ message: string }>> {
  await requirePermission("products.manage");
  try {
    const outcome = await runCronWithLock("fx-rates", () => syncTcmbRates({ skipAutoApply: true }), { force: true });
    revalidatePath(PAGE_PATH);
    if (outcome.status === "locked") return { success: false, error: "Kur senkronu şu anda çalışıyor, biraz sonra tekrar deneyin." };
    if (outcome.status === "skipped") return { success: true, message: "Kurlar güncel." };
    const result = outcome.result;
    if (result.status === "no-bulletin") return { success: true, message: "TCMB'de yeni bülten yok; son kur geçerli." };
    return {
      success: true,
      message:
        result.status === "stored"
          ? `${result.date} tarihli TCMB kurları kaydedildi.`
          : `Kurlar güncel (${result.date} bülteni).`,
    };
  } catch (error) {
    log.error("manual fx sync failed", { error });
    return { success: false, error: "TCMB kurları alınamadı. Daha sonra tekrar deneyin." };
  }
}
