"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItemType = "domain" | "hosting" | "server" | "ssl" | "datacenter";

export interface CartItem {
  id: string;
  type: CartItemType;
  title: string;
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
  };
}

interface AddDomainPayload {
  domain: string;
  price: number;
  renewPrice: number;
}

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
            unitPrice: price,
            quantity: 1,
            createdAt: new Date().toISOString(),
            metadata: { planCode: sku, billingPeriod },
          };

          return { items: [...state.items, nextItem] };
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
            unitPrice: price,
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
            unitPrice: price,
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
