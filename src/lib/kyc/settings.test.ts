import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { parseKycConfig } from "./settings";

describe("KYC settings", () => {
  it("defaults to vds, server, datacenter and 30 days", () => {
    expect(parseKycConfig({})).toEqual({ requiredCategories: ["vds", "server", "datacenter"], rejectedRetentionDays: 30 });
  });

  it("parses a custom list, an explicit empty list and invalid retention", () => {
    expect(parseKycConfig({ kyc_required_categories: " VDS; vps ,cloud,, x y" }).requiredCategories).toEqual(["vds", "vps", "cloud", "x", "y"]);
    expect(parseKycConfig({ kyc_required_categories: "-" }).requiredCategories).toEqual([]);
    expect(parseKycConfig({ kyc_rejected_retention_days: "0" }).rejectedRetentionDays).toBe(0);
    expect(parseKycConfig({ kyc_rejected_retention_days: "-5" }).rejectedRetentionDays).toBe(30);
    expect(parseKycConfig({ kyc_rejected_retention_days: "1.5" }).rejectedRetentionDays).toBe(30);
  });
});
