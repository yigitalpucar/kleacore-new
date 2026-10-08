"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  addonPeriodTotal,
  periodTotal,
  priceBasisForItemType,
} from "@/lib/billing/period-price";

export type CartItemType = "domain" | "hosting" | "server" | "ssl" | "datacenter";

export interface CartAddon {
  sku: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
}

export interface CartItem {
  id: string;
  type: CartItemType;
  title: string;
  /**
   * Pre-tax charge for ONE billing period (a yearly hosting/server item holds
   * the 12-month total, not the monthly equivalent). Mirrors the server-side
   * calculation in src/lib/actions/customer/checkout.ts.
   */
  unitPrice: number;
  quantity: number;
  createdAt: string;
  metadata?: {
    domain?: string;
    renewPrice?: number;
    category?: string;
    planCode?: string;
    billingPeriod?: "monthly" | "yearly";
    location?: string;
    subType?: string;
    domainChoice?: {
      type: "new" | "existing" | "later";
      domain?: string;
      price?: number;
      renewPrice?: number;
    };
    addons?: CartAddon[];
    configuration?: Record<string, string | number>;
  };
}

interface AddDomainPayload {
  domain: string;
  price: number;
  renewPrice: number;
}

/*
 * `price` on every payload is the catalogue tier price as shown on the site:
 * for yearly hosting/server plans that is the MONTHLY EQUIVALENT. The store
 * converts it to the period total with src/lib/billing/period-price.ts.
 */
interface AddHostingPayload {
  sku: string;
  title: string;
  price: number;
  billingPeriod: "monthly" | "yearly";
}

interface AddServerPlanPayload {
  category: "vds" | "vps" | "cloud" | "fiziksel";
  planCode: string;
  title: string;
  price: number;
  billingPeriod: "monthly" | "yearly";
  location?: string;
}

interface AddHostingBundlePayload {
  sku: string;
  title: string;
  price: number;
  billingPeriod: "monthly" | "yearly";
  domainChoice: {
    type: "new" | "existing" | "later";
    domain?: string;
    price?: number;
    renewPrice?: number;
  };
  addons: CartAddon[];
  configuration?: Record<string, string | number>;
  /** Configurable options total for the whole period (already a period total). */
  configOptionTotal?: number;
}

interface AddProductPayload {
  type: "ssl" | "datacenter";
  sku: string;
  title: string;
  price: number;
  billingPeriod: "monthly" | "yearly";
  subType?: string;
}

interface CartState {
  items: CartItem[];
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  addDomain: (payload: AddDomainPayload) => boolean;
  addHosting: (payload: AddHostingPayload) => boolean;
  addHostingBundle: (payload: AddHostingBundlePayload) => boolean;
  addServerPlan: (payload: AddServerPlanPayload) => boolean;
  addProduct: (payload: AddProductPayload) => boolean;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
}

function normalizeDomain(domain: string) {
  return domain.trim().toLowerCase();
}

function chargeFor(type: CartItemType, price: number, billingPeriod: "monthly" | "yearly") {
  return periodTotal(price, billingPeriod, priceBasisForItemType(type));
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      addDomain: ({ domain, price, renewPrice }) => {
        const normalizedDomain = normalizeDomain(domain);
        if (!normalizedDomain) return false;

        let wasAdded = false;

        set((state) => {
          const id = `domain:${normalizedDomain}`;
          const exists = state.items.some((item) => item.id === id);
          if (exists) return state;

          wasAdded = true;
          const nextItem: CartItem = {
            id,
            type: "domain",
            title: normalizedDomain,
            unitPrice: price,
            quantity: 1,
            createdAt: new Date().toISOString(),
            metadata: {
              domain: normalizedDomain,
              renewPrice,
            },
          };

          return { items: [...state.items, nextItem] };
        });

        return wasAdded;
      },

      addHosting: ({ sku, title, price, billingPeriod }) => {
        const normalizedSku = sku.trim().toUpperCase();
        if (!normalizedSku) return false;

        let wasAdded = false;

        set((state) => {
          const id = `hosting:${normalizedSku}:${billingPeriod}`;
          const exists = state.items.some((item) => item.id === id);
          if (exists) return state;

          wasAdded = true;
          const nextItem: CartItem = {
            id,
            type: "hosting",
            title,
            unitPrice: chargeFor("hosting", price, billingPeriod),
            quantity: 1,
            createdAt: new Date().toISOString(),
            metadata: { planCode: sku, billingPeriod },
          };

          return { items: [...state.items, nextItem] };
        });

        return wasAdded;
      },

      addHostingBundle: ({
        sku,
        title,
        price,
        billingPeriod,
        domainChoice,
        addons,
        configuration,
        configOptionTotal = 0,
      }) => {
        const normalizedSku = sku.trim().toUpperCase();
        if (!normalizedSku) return false;

        let wasAdded = false;

        set((state) => {
          const id = `hosting:${normalizedSku}:${billingPeriod}`;
          const exists = state.items.some((item) => item.id === id);
          if (exists) return state;

          wasAdded = true;

          const addonTotal = addons.reduce(
            (sum, a) => sum + addonPeriodTotal(a, billingPeriod),
            0
          );
          const domainPrice = domainChoice.type === "new" ? (domainChoice.price ?? 0) : 0;

          const nextItems: CartItem[] = [
            {
              id,
              type: "hosting",
              title,
              unitPrice:
                Math.round(
                  (chargeFor("hosting", price, billingPeriod) + addonTotal + configOptionTotal) * 100
                ) / 100,
              quantity: 1,
              createdAt: new Date().toISOString(),
              metadata: {
                planCode: sku,
                billingPeriod,
                domainChoice,
                addons,
                configuration,
              },
            },
          ];

          if (domainChoice.type === "new" && domainChoice.domain) {
            const domainId = `domain:${domainChoice.domain.toLowerCase()}`;
            if (!state.items.some((item) => item.id === domainId)) {
              nextItems.push({
                id: domainId,
                type: "domain",
                title: domainChoice.domain.toLowerCase(),
                unitPrice: domainPrice,
                quantity: 1,
                createdAt: new Date().toISOString(),
                metadata: {
                  domain: domainChoice.domain.toLowerCase(),
                  renewPrice: domainChoice.renewPrice ?? 0,
                },
              });
            }
          }

          return { items: [...state.items, ...nextItems] };
        });

        return wasAdded;
      },

      addServerPlan: ({ category, planCode, title, price, billingPeriod, location }) => {
        const normalizedPlanCode = planCode.trim().toLowerCase();
        const normalizedLocation = (location ?? "global").trim().toLowerCase();
        if (!normalizedPlanCode) return false;

        let wasAdded = false;

        set((state) => {
          const id = `server:${category}:${normalizedPlanCode}:${billingPeriod}:${normalizedLocation}`;
          const exists = state.items.some((item) => item.id === id);
          if (exists) return state;

          wasAdded = true;
          const nextItem: CartItem = {
            id,
            type: "server",
            title,
            unitPrice: chargeFor("server", price, billingPeriod),
            quantity: 1,
            createdAt: new Date().toISOString(),
            metadata: {
              category,
              planCode: planCode.trim(),
              billingPeriod,
              location: location?.trim(),
            },
          };

          return { items: [...state.items, nextItem] };
        });

        return wasAdded;
      },

      addProduct: ({ type, sku, title, price, billingPeriod, subType }) => {
        const normalizedSku = sku.trim().toUpperCase();
        if (!normalizedSku) return false;

        let wasAdded = false;

        set((state) => {
          const id = `${type}:${normalizedSku}:${billingPeriod}`;
          const exists = state.items.some((item) => item.id === id);
          if (exists) return state;

          wasAdded = true;
          const nextItem: CartItem = {
            id,
            type,
            title,
            unitPrice: chargeFor(type, price, billingPeriod),
            quantity: 1,
            createdAt: new Date().toISOString(),
            metadata: { planCode: sku, billingPeriod, subType },
          };

          return { items: [...state.items, nextItem] };
        });

        return wasAdded;
      },

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      clearCart: () => set({ items: [] }),

      getTotalItems: () =>
        get().items.reduce((total, item) => total + item.quantity, 0),

      getSubtotal: () =>
        get().items.reduce(
          (total, item) => total + item.unitPrice * item.quantity,
          0,
        ),
    }),
    {
      name: "kleacore-cart",
      // v1: yearly hosting/server items store the 12-month total instead of
      // the monthly equivalent. Older carts are migrated below.
      version: 1,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as { items?: CartItem[] };
        if (version < 1 && Array.isArray(state.items)) {
          state.items = state.items.map((item) =>
            item.metadata?.billingPeriod === "yearly" &&
            priceBasisForItemType(item.type) === "monthly-equivalent"
              ? { ...item, unitPrice: chargeFor(item.type, item.unitPrice, "yearly") }
              : item
          );
        }
        return state as CartState;
      },
      storage:
        typeof window !== "undefined"
          ? createJSONStorage(() => localStorage)
          : undefined,
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
