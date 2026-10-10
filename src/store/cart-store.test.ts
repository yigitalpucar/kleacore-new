import { beforeEach, describe, expect, it } from "vitest";
import { useCartStore } from "./cart-store";

describe("addServerPlan", () => {
  beforeEach(() => useCartStore.getState().clearCart());

  it("keeps the plain plan line as before", () => {
    useCartStore.getState().addServerPlan({
      category: "vds",
      planCode: "VDS-2",
      title: "VDS-2",
      price: 117.59,
      billingPeriod: "yearly",
      location: "tr",
    });
    const [item] = useCartStore.getState().items;
    expect(item.id).toBe("server:vds:vds-2:yearly:tr");
    expect(item.unitPrice).toBe(1411.08);
    expect(item.metadata).not.toHaveProperty("configuration");
    expect(item.metadata).not.toHaveProperty("hostname");
  });

  it("carries configurator selections, labels and hostname, adding the option total", () => {
    const add = () =>
      useCartStore.getState().addServerPlan({
        category: "vds",
        planCode: "VDS-1",
        title: "VDS-1",
        price: 99.99,
        billingPeriod: "monthly",
        location: "tr",
        configuration: { os: "ubuntu-24-04" },
        configurationLabels: [{ name: "İşletim Sistemi", label: "Ubuntu 24.04 LTS" }],
        configOptionTotal: 10,
        hostname: " Web01.Ornek.com ",
      });

    expect(add()).toBe(true);
    const [item] = useCartStore.getState().items;
    expect(item.id).toBe("server:vds:vds-1:monthly:tr:os=ubuntu-24-04:web01.ornek.com");
    expect(item.unitPrice).toBe(109.99);
    expect(item.metadata).toMatchObject({
      planCode: "VDS-1",
      configuration: { os: "ubuntu-24-04" },
      hostname: "web01.ornek.com",
    });
    // Same configuration twice is one line.
    expect(add()).toBe(false);
  });
});
