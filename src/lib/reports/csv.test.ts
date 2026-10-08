import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { CSV_BOM, csvAmount, csvCell, csvContentDisposition, toCsv } from "./csv";

describe("csvCell", () => {
  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('Kleacore "Bulut"')).toBe('"Kleacore ""Bulut"""');
    expect(csvCell("satır\nsatır")).toBe('"satır\nsatır"');
    expect(csvCell("a,b")).toBe("a,b"); // , is not the separator
    expect(csvCell("düz metin")).toBe("düz metin");
  });

  it("neutralises formula injection in text but not in numbers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+90 555")).toBe("'+90 555");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-12.5)).toBe("-12,5");
    expect(csvCell(csvAmount(new Prisma.Decimal("-1234.5")))).toBe("-1234,50");
  });

  it("formats amounts with a decimal comma and fixed kuruş", () => {
    expect(csvCell(csvAmount("1234.5"))).toBe("1234,50");
    expect(csvCell(csvAmount(new Prisma.Decimal("10.005")))).toBe("10,01");
    expect(csvCell(csvAmount(null))).toBe("");
    expect(csvCell(new Prisma.Decimal("41.7278"))).toBe("41,7278");
  });

  it("renders empty values, booleans and dates", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(true)).toBe("Evet");
    expect(csvCell(new Date("2026-10-08T12:00:00Z"))).toBe("2026-10-08T12:00:00.000Z");
  });
});

describe("toCsv", () => {
  it("starts with a UTF-8 BOM and joins with ; and CRLF", () => {
    const csv = toCsv([
      ["Ay", "Matrah"],
      ["Ekim 2026", csvAmount("100")],
    ]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}Ay;Matrah\r\nEkim 2026;100,00\r\n`);
    expect(Buffer.from(csv, "utf8").subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });

  it("can omit the BOM", () => {
    expect(toCsv([["a"]], { bom: false })).toBe("a\r\n");
  });
});

describe("csvContentDisposition", () => {
  it("gives an ASCII fallback and the UTF-8 name", () => {
    expect(csvContentDisposition("kdv-tahakkuk-şubat.csv")).toBe(
      "attachment; filename=\"kdv-tahakkuk-subat.csv\"; filename*=UTF-8''kdv-tahakkuk-%C5%9Fubat.csv"
    );
  });
});
