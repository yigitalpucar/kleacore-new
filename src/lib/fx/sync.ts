/**
 * Daily TCMB rate sync (`fx-rates` cron, advisory lock + CronRun via
 * runCronJob). Idempotent: rows are upserted by (currency, bulletin date), so
 * a weekend/holiday run that sees Friday's bulletin again changes nothing and
 * the last rate simply stays in effect.
 *
 * After a successful sync the opt-in TLD auto-apply runs (rules.autoApply,
 * default off): see applyTldSuggestedPrices.
 */
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { FX_CURRENCIES, TCMB_TODAY_URL, fetchTcmbBulletin, tcmbArchiveUrl } from "./tcmb";
import { dayToDbDate } from "./rates";
import { applyTldSuggestedPrices, getTldPricingRules } from "./tld-pricing";

const log = createLogger("fx.sync");

export interface FxSyncResult {
  status: "stored" | "unchanged" | "no-bulletin";
  /** Bulletin date that was read. */
  date?: string;
  bulletinNo?: string | null;
  currencies?: string[];
  created?: number;
  updated?: number;
  autoApply?: { applied: number; skipped: number } | { error: string } | "disabled";
}

export interface FxSyncOptions {
  /** Backfill one day from the TCMB archive ("YYYY-MM-DD"); default today.xml. */
  date?: string;
  fetchImpl?: typeof fetch;
  /** Skip the TLD auto-apply step (backfills). */
  skipAutoApply?: boolean;
}

export async function syncTcmbRates(options: FxSyncOptions = {}): Promise<FxSyncResult> {
  const url = options.date ? tcmbArchiveUrl(options.date) : TCMB_TODAY_URL;
  const fetched = await fetchTcmbBulletin(url, options.fetchImpl);
  if (fetched.status === "not-found") {
    log.info("no TCMB bulletin", { url });
    return { status: "no-bulletin", date: options.date };
  }

  const { bulletin } = fetched;
  const date = dayToDbDate(bulletin.date);
  let created = 0;
  let updated = 0;
  const currencies: string[] = [];

  for (const rate of bulletin.rates) {
    if (!(FX_CURRENCIES as readonly string[]).includes(rate.currency)) continue;
    currencies.push(rate.currency);
    const existing = await db.exchangeRate.findUnique({
      where: { currency_date: { currency: rate.currency, date } },
      select: { id: true, buying: true, selling: true, banknoteSelling: true },
    });
    if (!existing) {
      await db.exchangeRate.create({
        data: {
          currency: rate.currency,
          date,
          buying: rate.buying,
          selling: rate.selling,
          banknoteSelling: rate.banknoteSelling,
          bulletinNo: bulletin.bulletinNo,
          source: "TCMB",
        },
      });
      created += 1;
    } else if (
      !existing.buying.eq(rate.buying) ||
      !existing.selling.eq(rate.selling) ||
      String(existing.banknoteSelling ?? "") !== String(rate.banknoteSelling ?? "")
    ) {
      // TCMB occasionally republishes a corrected bulletin for the same day.
      await db.exchangeRate.update({
        where: { id: existing.id },
        data: {
          buying: rate.buying,
          selling: rate.selling,
          banknoteSelling: rate.banknoteSelling,
          bulletinNo: bulletin.bulletinNo,
        },
      });
      updated += 1;
    }
  }

  if (currencies.length === 0) {
    throw new Error("TCMB bülteninde USD/EUR/GBP bulunamadı");
  }

  const result: FxSyncResult = {
    status: created + updated > 0 ? "stored" : "unchanged",
    date: bulletin.date,
    bulletinNo: bulletin.bulletinNo,
    currencies,
    created,
    updated,
  };

  if (!options.skipAutoApply && !options.date) {
    result.autoApply = await runAutoApply();
  }

  return result;
}

async function runAutoApply(): Promise<FxSyncResult["autoApply"]> {
  const rules = await getTldPricingRules();
  if (!rules.autoApply) return "disabled";
  if (!rules.updatedBy) {
    // Audit entries need the admin who switched auto-apply on.
    return { error: "Otomatik uygulama açık ama kuralı kaydeden yönetici bilinmiyor" };
  }
  try {
    const outcome = await applyTldSuggestedPrices({ actorId: rules.updatedBy, source: "auto" });
    if (!outcome.ok) return { error: outcome.error };
    if (outcome.applied.length > 0 || outcome.skipped.length > 0) {
      log.info("TLD prices auto-applied", { applied: outcome.applied.length, skipped: outcome.skipped });
    }
    return { applied: outcome.applied.length, skipped: outcome.skipped.length };
  } catch (error) {
    log.error("TLD auto-apply failed", { error });
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
