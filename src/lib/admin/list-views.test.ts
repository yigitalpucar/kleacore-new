import { describe, expect, it } from "vitest";
import {
  describeListView,
  isValidListPath,
  listCapabilities,
  listViewToParams,
  parseListView,
} from "./list-views";

describe("list views", () => {
  it("round-trips search and filters through the query string", () => {
    const params = listViewToParams({ q: " acme ", filters: { status: "OVERDUE", type: "all", priority: "" } });
    expect(params.toString()).toBe("q=acme&f_status=OVERDUE");
    expect(parseListView(params, ["status", "type"])).toEqual({ q: "acme", filters: { status: "OVERDUE", type: "all" } });
  });

  it("drops unknown filters and malformed values, falling back to defaults", () => {
    const view = parseListView(
      { q: "x", f_status: "PAID", f_evil: "1", f_priority: "<script>" },
      ["status", "priority", "department"],
      { department: "BILLING" }
    );
    expect(view).toEqual({ q: "x", filters: { status: "PAID", priority: "all", department: "BILLING" } });
  });

  it("caps the search text", () => {
    expect(parseListView({ q: "a".repeat(500) }, []).q).toHaveLength(200);
  });

  it("describes a view", () => {
    expect(describeListView({ q: "", filters: { status: "all" } })).toBe("Filtresiz");
    expect(describeListView({ q: "acme", filters: { status: "PAID", type: "CORPORATE" } })).toBe("“acme” · 2 filtre");
  });

  it("only accepts paths under the list's route", () => {
    expect(isValidListPath("invoices", "/yonetim/faturalar/gecikmis")).toBe(true);
    expect(isValidListPath("invoices", "/yonetim/faturalar")).toBe(true);
    expect(isValidListPath("invoices", "/yonetim/faturalarx")).toBe(false);
    expect(isValidListPath("invoices", "/yonetim/hizmetler")).toBe(false);
    expect(isValidListPath("invoices", "https://evil.example/yonetim/faturalar")).toBe(false);
    expect(isValidListPath("invoices", "/yonetim/faturalar//evil.example")).toBe(false);
  });
});

describe("list capabilities", () => {
  it("grants bulk actions with the single action's permission", () => {
    expect(listCapabilities("BILLING", "invoices")).toEqual({ bulk: ["remind", "cancel"], export: true });
    expect(listCapabilities("SUPPORT", "tickets")).toEqual({ bulk: ["assign", "close"], export: false });
    expect(listCapabilities("SUPPORT", "services")).toEqual({ bulk: [], export: false });
    expect(listCapabilities("ADMIN", "orders")).toEqual({ bulk: ["cancel"], export: true });
  });

  it("export needs export.csv and the list's view permission", () => {
    // BILLING has export.csv but cannot see tickets or services.
    expect(listCapabilities("BILLING", "tickets").export).toBe(false);
    expect(listCapabilities("BILLING", "services").export).toBe(false);
    expect(listCapabilities("BILLING", "customers").export).toBe(true);
    expect(listCapabilities("CUSTOMER", "invoices")).toEqual({ bulk: [], export: false });
  });
});
