import { describe, expect, it } from "vitest";
import { cartItemIdForPeriod, useCartStore } from "./cart-store";

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
