import { describe, expect, it } from "vitest";
import { niceCeilBytes, areaPath, formatAxisTime, formatBytesPerSecond, formatMegabytes, linePath, niceCeil, seriesStats } from "./metrics";

describe("metrics formatting", () => {
  it("formats byte rates with binary units", () => {
    expect(formatBytesPerSecond(0)).toBe("0 B/sn");
    expect(formatBytesPerSecond(512)).toBe("512 B/sn");
    expect(formatBytesPerSecond(1536)).toBe("1,5 KB/sn");
    expect(formatBytesPerSecond(150 * 1024 * 1024)).toBe("150 MB/sn");
    expect(formatBytesPerSecond(-5)).toBe("0 B/sn");
  });

  it("formats memory", () => {
    expect(formatMegabytes(512)).toBe("512 MB");
    expect(formatMegabytes(1536)).toBe("1,5 GB");
  });

  it("rounds axis maxima up to nice numbers", () => {
    expect(niceCeil(0)).toBe(0);
    expect(niceCeil(7)).toBe(10);
    expect(niceCeil(13)).toBe(20);
    expect(niceCeil(21)).toBe(25);
    expect(niceCeil(100)).toBe(100);
    expect(niceCeil(0.3)).toBe(0.5);
  });

  it("rounds byte axes in the displayed unit", () => {
    expect(niceCeilBytes(3.8 * 1024 * 1024)).toBe(5 * 1024 * 1024);
    expect(niceCeilBytes(900 * 1024)).toBe(1000 * 1024);
    expect(niceCeilBytes(0)).toBe(0);
  });

  it("summarises only defined values", () => {
    expect(seriesStats([undefined, null])).toBeNull();
    expect(seriesStats([2, undefined, 4])).toEqual({ min: 2, max: 4, avg: 3, last: 4 });
  });

  it("formats times in Europe/Istanbul", () => {
    const ms = Date.UTC(2026, 9, 8, 11, 30);
    expect(formatAxisTime(ms, "hour")).toBe("14:30");
    expect(formatAxisTime(ms, "week")).toBe("8 Eki");
  });
});

describe("chart paths", () => {
  it("draws a line bottom-up and breaks it at gaps", () => {
    expect(linePath([0, 50, 100], 100, 10, 100)).toBe("M0 10L50 5L100 0");
    expect(linePath([10, 10, undefined, 20, 20], 4, 10, 20)).toBe("M0 5L1 5M3 0L4 0");
  });

  it("keeps isolated points visible and clamps to the axis", () => {
    expect(linePath([undefined, 200, undefined], 100, 10, 100)).toBe("M49 0L51 0");
    expect(linePath([], 100, 10, 100)).toBe("");
    expect(linePath([1, 2], 100, 10, 0)).toBe("");
  });

  it("closes areas to the baseline per run", () => {
    expect(areaPath([0, 100], 10, 10, 100)).toBe("M0 10L0 10L10 0L10 10Z");
    expect(areaPath([50, undefined, 50], 10, 10, 100)).toBe("");
  });
});
