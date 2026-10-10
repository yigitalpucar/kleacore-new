import { beforeEach, describe, expect, it } from "vitest";
import { cartItemIdForPeriod, useCartStore } from "./cart-store";

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

describe("cart period switching", () => {
  it("rewrites the period segment of line ids", () => {
    expect(cartItemIdForPeriod({ id: "hosting:HST-LNX-01:monthly", type: "hosting" }, "yearly")).toBe(
      "hosting:HST-LNX-01:yearly"
    );
    expect(cartItemIdForPeriod({ id: "server:vds:vds-01:yearly:istanbul", type: "server" }, "monthly")).toBe(
      "server:vds:vds-01:monthly:istanbul"
    );
    expect(cartItemIdForPeriod({ id: "domain:a.com", type: "domain" }, "yearly")).toBeNull();
  });

  it("switches a line with the quoted price and refuses duplicates", () => {
    const store = useCartStore.getState();
    store.clearCart();
    store.addHosting({ sku: "HST-LNX-01", title: "Starter", price: 49, billingPeriod: "monthly" });
    expect(useCartStore.getState().setItemPeriod("hosting:HST-LNX-01:monthly", "yearly", 468)).toBe(true);
    const [item] = useCartStore.getState().items;
    expect(item).toMatchObject({ id: "hosting:HST-LNX-01:yearly", unitPrice: 468, metadata: { billingPeriod: "yearly" } });

    store.addHosting({ sku: "HST-LNX-01", title: "Starter", price: 49, billingPeriod: "monthly" });
    expect(useCartStore.getState().setItemPeriod("hosting:HST-LNX-01:monthly", "yearly", 468)).toBe(false);
  });

  it("syncs stale prices from the server quote", () => {
    const store = useCartStore.getState();
    store.clearCart();
    store.addDomain({ domain: "a.com", price: 100, renewPrice: 120 });
    store.syncItemPrices({ "domain:a.com": 149 });
    expect(useCartStore.getState().items[0].unitPrice).toBe(149);
  });
});

describe("period switching keeps configurator data", () => {
  beforeEach(() => useCartStore.getState().clearCart());

  it("switches a configured server line and keeps its selections and hostname", () => {
    useCartStore.getState().addServerPlan({
      category: "vds",
      planCode: "VDS-1",
      title: "VDS-1",
      price: 99.99,
      billingPeriod: "monthly",
      location: "tr",
      configuration: { os: "ubuntu-24-04" },
      hostname: "web01.ornek.com",
    });
    const id = "server:vds:vds-1:monthly:tr:os=ubuntu-24-04:web01.ornek.com";
    expect(useCartStore.getState().setItemPeriod(id, "yearly", 1199.88)).toBe(true);
    const [item] = useCartStore.getState().items;
    expect(item.id).toBe("server:vds:vds-1:yearly:tr:os=ubuntu-24-04:web01.ornek.com");
    expect(item.metadata).toMatchObject({
      billingPeriod: "yearly",
      configuration: { os: "ubuntu-24-04" },
      hostname: "web01.ornek.com",
    });
  });
});
