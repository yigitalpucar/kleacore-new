import { describe, expect, it } from "vitest";
import { parseDomainQuery, pickSearchTlds } from "./search-query";

describe("parseDomainQuery", () => {
  it("extracts the label and typed extension", () => {
    expect(parseDomainQuery("https://www.Ornek.com.tr/x")).toEqual({ label: "ornek", ext: ".com.tr" });
    expect(parseDomainQuery("  yeni-marka ")).toEqual({ label: "yeni-marka", ext: null });
    expect(parseDomainQuery("ornek.")).toEqual({ label: "ornek", ext: null });
  });

  it("rejects invalid labels", () => {
    expect(parseDomainQuery("")).toBeNull();
    expect(parseDomainQuery("örnek")).toBeNull();
    expect(parseDomainQuery("-ornek")).toBeNull();
  });
});

describe("pickSearchTlds", () => {
  it("puts the typed extension first when it is sold", () => {
    expect(pickSearchTlds([".com", ".net", ".com.tr"], ".com.tr", 2)).toEqual([".com.tr", ".com"]);
    expect(pickSearchTlds([".com", ".net"], ".xyz", 5)).toEqual([".com", ".net"]);
  });
});
