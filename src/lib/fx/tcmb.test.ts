import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TcmbParseError, fetchTcmbBulletin, parseTcmbXml, tcmbArchiveUrl } from "./tcmb";

const fixture = readFileSync(join(__dirname, "__fixtures__", "tcmb-today.xml"), "utf8");

describe("parseTcmbXml", () => {
  it("reads the bulletin date, number and USD/EUR/GBP forex + banknote rates as exact decimals", () => {
    const bulletin = parseTcmbXml(fixture);
    expect(bulletin.date).toBe("2026-10-08");
    expect(bulletin.bulletinNo).toBe("2026/190");

    const usd = bulletin.rates.find((r) => r.currency === "USD")!;
    expect(usd.buying.toString()).toBe("41.6528");
    expect(usd.selling.toString()).toBe("41.7278");
    expect(usd.banknoteSelling?.toString()).toBe("41.7904");

    const eur = bulletin.rates.find((r) => r.currency === "EUR")!;
    expect(eur.selling.toString()).toBe("48.5684");
    const gbp = bulletin.rates.find((r) => r.currency === "GBP")!;
    expect(gbp.buying.toString()).toBe("55.9211");
  });

  it("normalises per-100 units (JPY) to TRY per 1 unit", () => {
    const jpy = parseTcmbXml(fixture).rates.find((r) => r.currency === "JPY")!;
    expect(jpy.selling.toString()).toBe("0.275764");
  });

  it("skips currencies without a forex selling rate (XDR)", () => {
    expect(parseTcmbXml(fixture).rates.some((r) => r.currency === "XDR")).toBe(false);
  });

  it("rejects documents that are not a TCMB bulletin", () => {
    expect(() => parseTcmbXml("<html><body>Bakım</body></html>")).toThrow(TcmbParseError);
    expect(() => parseTcmbXml('<Tarih_Date Tarih="bad"></Tarih_Date>')).toThrow(TcmbParseError);
    expect(() => parseTcmbXml('<Tarih_Date Tarih="08.10.2026"></Tarih_Date>')).toThrow(/kur bulunamadı/);
  });
});

describe("fetchTcmbBulletin", () => {
  it("treats a 404 (weekend/holiday archive) as no bulletin, not an error", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    await expect(fetchTcmbBulletin(tcmbArchiveUrl("2026-10-10"), fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      status: "not-found",
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://www.tcmb.gov.tr/kurlar/202610/10102026.xml", expect.anything());
  });

  it("throws on server errors so the cron run is marked failed", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 503 }));
    await expect(fetchTcmbBulletin(undefined, fetchImpl as unknown as typeof fetch)).rejects.toThrow(/503/);
  });

  it("parses a successful response", async () => {
    const fetchImpl = vi.fn(async () => new Response(fixture, { status: 200 }));
    const result = await fetchTcmbBulletin(undefined, fetchImpl as unknown as typeof fetch);
    expect(result.status).toBe("ok");
  });
});
