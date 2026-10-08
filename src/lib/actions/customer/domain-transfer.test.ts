import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/integrations/registrar/config", () => ({
  getRegistrarConfig: vi.fn(),
  isGriRegistrarEnabled: vi.fn(),
}));
vi.mock("@/lib/domains/transfer", () => ({
  processAutomatedDomainTransfer: vi.fn(),
  createManualDomainTransferTicket: vi.fn(),
}));

import * as actions from "./domain-transfer";

describe("domain-transfer server actions module", () => {
  it("only exposes session-authenticated actions", () => {
    // Helpers that take a caller-supplied customer object must not be
    // callable as server actions.
    expect(Object.keys(actions).sort()).toEqual([
      "isAutomatedDomainTransferAvailable",
      "submitCustomerDomainTransfer",
    ]);
  });
});
