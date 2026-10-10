import { describe, expect, it } from "vitest";
import { PANEL_EMPTY_PRESETS } from "./empty-presets";

describe("customer panel empty states", () => {
  const entries = Object.entries(PANEL_EMPTY_PRESETS) as [string, (typeof PANEL_EMPTY_PRESETS)[keyof typeof PANEL_EMPTY_PRESETS]][];

  it.each(entries)("%s: icon, title and exactly one sentence", (_kind, preset) => {
    expect(preset.icon).toBeTruthy();
    expect(preset.title.length).toBeGreaterThan(3);
    expect(preset.description.trim().endsWith(".")).toBe(true);
    // one sentence: no sentence break inside (". " followed by a capital letter)
    expect(preset.description.slice(0, -1)).not.toMatch(/[.!?]\s+[A-ZÇĞİÖŞÜ]/);
  });

  it.each(entries)("%s: the primary action is an internal link", (_kind, preset) => {
    const cta = "cta" in preset ? preset.cta : undefined;
    if (!cta) return;
    expect(cta.href).toMatch(/^(\/|#)/);
    expect(cta.label.length).toBeGreaterThan(2);
  });
});
