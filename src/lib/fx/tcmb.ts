/**
 * TCMB (Türkiye Cumhuriyet Merkez Bankası) daily indicative exchange rates.
 *
 * `https://www.tcmb.gov.tr/kurlar/today.xml` is the latest bulletin (published
 * on business days around 15:30 Istanbul time). On weekends and public holidays
 * no bulletin is published: today.xml keeps serving the previous one, and the
 * archive URL of that day answers 404. Either way the stored rate of the last
 * bulletin stays in effect (see getRate).
 *
 * Rates are TRY per `Unit` of the currency (JPY is quoted per 100); parsed
 * values are normalised to TRY per 1 unit and kept as exact decimal strings.
 */
import { XMLParser } from "fast-xml-parser";
import { Prisma } from "@prisma/client";

export const TCMB_TODAY_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

/** Currencies we store (registrar costs are USD; EUR/GBP for completeness). */
export const FX_CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

export function isFxCurrency(value: string): value is FxCurrency {
  return (FX_CURRENCIES as readonly string[]).includes(value);
}

export interface TcmbRate {
  currency: string;
  /** TRY per 1 unit (ForexBuying / Unit). */
  buying: Prisma.Decimal;
  /** TRY per 1 unit (ForexSelling / Unit). */
  selling: Prisma.Decimal;
  /** TRY per 1 unit (BanknoteSelling / Unit), null when not published. */
  banknoteSelling: Prisma.Decimal | null;
}

export interface TcmbBulletin {
  /** Bulletin date, "YYYY-MM-DD" (Istanbul calendar day). */
  date: string;
  bulletinNo: string | null;
  rates: TcmbRate[];
}

export class TcmbParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TcmbParseError";
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  // Keep the numbers as text: they go straight into Decimal.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => name === "Currency",
});

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  // <ForexSelling/> parses as "" with parseTagValue off, but be defensive.
  return "";
}

function decimalOrNull(value: unknown): Prisma.Decimal | null {
  const raw = text(value);
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const parsed = new Prisma.Decimal(raw);
  return parsed.isZero() ? null : parsed;
}

/** "08.10.2026" → "2026-10-08". */
function parseTarih(value: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/**
 * Parses a TCMB bulletin (today.xml or an archive file). Currencies without a
 * forex buying/selling pair (e.g. XDR) are skipped. Throws TcmbParseError when
 * the document is not a TCMB bulletin, so a changed format fails the cron run
 * loudly instead of storing garbage.
 */
export function parseTcmbXml(xml: string): TcmbBulletin {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch (error) {
    throw new TcmbParseError(`XML okunamadı: ${error instanceof Error ? error.message : String(error)}`);
  }

  const root = doc.Tarih_Date as Record<string, unknown> | undefined;
  if (!root || typeof root !== "object") {
    throw new TcmbParseError("Tarih_Date kök öğesi yok");
  }

  const date = parseTarih(text(root["@Tarih"]));
  if (!date) throw new TcmbParseError("Bülten tarihi okunamadı");

  const rates: TcmbRate[] = [];
  for (const item of (root.Currency as Array<Record<string, unknown>> | undefined) ?? []) {
    const currency = text(item["@CurrencyCode"] ?? item["@Kod"]).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) continue;

    const unitRaw = text(item.Unit);
    const unit = /^\d+$/.test(unitRaw) && Number(unitRaw) > 0 ? new Prisma.Decimal(unitRaw) : new Prisma.Decimal(1);
    const buying = decimalOrNull(item.ForexBuying);
    const selling = decimalOrNull(item.ForexSelling);
    if (!buying || !selling) continue;
    const banknoteSelling = decimalOrNull(item.BanknoteSelling);

    rates.push({
      currency,
      buying: buying.dividedBy(unit).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP),
      selling: selling.dividedBy(unit).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP),
      banknoteSelling: banknoteSelling
        ? banknoteSelling.dividedBy(unit).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP)
        : null,
    });
  }

  if (rates.length === 0) throw new TcmbParseError("Bültende kur bulunamadı");

  const bulletinNo = text(root["@Bulten_No"]) || null;
  return { date, bulletinNo, rates };
}

/**
 * Archive URL of one day's bulletin (backfill):
 * https://www.tcmb.gov.tr/kurlar/202610/08102026.xml
 */
export function tcmbArchiveUrl(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Geçersiz tarih: ${date}`);
  const [, year, month, day] = match;
  return `https://www.tcmb.gov.tr/kurlar/${year}${month}/${day}${month}${year}.xml`;
}

export type TcmbFetchResult =
  | { status: "ok"; bulletin: TcmbBulletin }
  /** No bulletin for that day (weekend/holiday archive 404). */
  | { status: "not-found" };

/**
 * Downloads and parses a bulletin. A 404 is "no bulletin" (not an error);
 * other HTTP errors, timeouts and parse errors throw so the cron run is
 * recorded as FAILED.
 */
export async function fetchTcmbBulletin(
  url: string = TCMB_TODAY_URL,
  fetchImpl: typeof fetch = fetch
): Promise<TcmbFetchResult> {
  const response = await fetchImpl(url, {
    headers: { accept: "application/xml,text/xml" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return { status: "not-found" };
  if (!response.ok) throw new Error(`TCMB yanıtı ${response.status}`);
  return { status: "ok", bulletin: parseTcmbXml(await response.text()) };
}
