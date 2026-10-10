import { describe, expect, it } from "vitest";
import { flattenSections, matchesQuery, moveActive } from "./command-palette-model";
import { navigationTarget } from "./route-progress";

describe("matchesQuery", () => {
  it("folds Turkish case and diacritics, every word must match", () => {
    expect(matchesQuery("Faturalarım", "fatura")).toBe(true);
    expect(matchesQuery("Ödeme yöntemleri", "odeme")).toBe(true);
    expect(matchesQuery("İstatistikler", "istat")).toBe(true);
    expect(matchesQuery("Yeni destek talebi", "destek yeni")).toBe(true);
    expect(matchesQuery("Yeni destek talebi", "destek fatura")).toBe(false);
    expect(matchesQuery("Anything", "   ")).toBe(true);
  });
});

describe("flattenSections / moveActive", () => {
  it("drops empty sections and wraps arrow navigation", () => {
    const { visible, flat } = flattenSections([
      { key: "a", label: "A", entries: [{ key: "1", title: "x", href: "/x" }] },
      { key: "b", label: "B", entries: [] },
      { key: "c", label: "C", entries: [{ key: "2", title: "y", href: "/y" }, { key: "3", title: "z", href: "/z" }] },
    ]);
    expect(visible.map((s) => s.key)).toEqual(["a", "c"]);
    expect(flat.map((e) => e.key)).toEqual(["1", "2", "3"]);
    expect(moveActive(2, "ArrowDown", 3)).toBe(0);
    expect(moveActive(0, "ArrowUp", 3)).toBe(2);
    expect(moveActive(1, "End", 3)).toBe(2);
    expect(moveActive(5, "ArrowDown", 0)).toBe(0);
  });
});

describe("navigationTarget (progress bar trigger)", () => {
  const current = new URL("https://kleacore.test/musteri/panel");
  const click = (href: string, extra: Partial<MouseEvent> = {}, attrs: Record<string, string> = {}) => {
    const anchor = {
      href: new URL(href, current).toString(),
      target: attrs.target ?? "",
      dataset: {} as Record<string, string>,
      hasAttribute: (name: string) => name in attrs,
    };
    return { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: { closest: () => anchor }, ...extra } as unknown as MouseEvent;
  };

  it("starts for internal links to another page", () => {
    expect(navigationTarget(click("/musteri/panel/faturalar"), current)?.pathname).toBe("/musteri/panel/faturalar");
  });

  it("ignores new-tab, modified, external, download and same-page clicks", () => {
    expect(navigationTarget(click("/x", { metaKey: true }), current)).toBeNull();
    expect(navigationTarget(click("/x", {}, { target: "_blank" }), current)).toBeNull();
    expect(navigationTarget(click("https://example.com/"), current)).toBeNull();
    expect(navigationTarget(click("/x", {}, { download: "" }), current)).toBeNull();
    expect(navigationTarget(click("/musteri/panel#main"), current)).toBeNull();
  });
});
