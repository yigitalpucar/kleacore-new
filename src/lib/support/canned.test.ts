import { describe, expect, it } from "vitest";
import { renderCannedReply } from "./canned";

describe("renderCannedReply", () => {
  it("fills known variables (spaces allowed) and leaves unknown ones visible", () => {
    expect(
      renderCannedReply("Merhaba {{customer.firstName}},\n{{ ticket.number }} numaralı talebiniz… {{staff.name}} / {{customer.tckn}}", {
        "customer.firstName": "Ayşe",
        "ticket.number": "T-123456",
        "staff.name": "Yiğit",
      })
    ).toBe("Merhaba Ayşe,\nT-123456 numaralı talebiniz… Yiğit / {{customer.tckn}}");
  });

  it("does not re-expand variables contained in values", () => {
    expect(renderCannedReply("{{customer.name}}", { "customer.name": "{{staff.name}}", "staff.name": "X" })).toBe("{{staff.name}}");
  });
});
