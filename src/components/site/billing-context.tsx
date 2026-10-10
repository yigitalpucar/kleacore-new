"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { BillingPeriod } from "@/lib/format/price";

type BillingState = { billing: BillingPeriod; setBilling: (value: BillingPeriod) => void };

const BillingContext = createContext<BillingState | null>(null);

/**
 * One monthly/yearly choice for a whole page: every BillingSwitch, plan
 * table, comparison and configurator inside reads and writes the same value.
 */
export function BillingProvider({
  children,
  initial = "monthly",
}: {
  children: React.ReactNode;
  initial?: BillingPeriod;
}) {
  const [billing, setBilling] = useState<BillingPeriod>(initial);
  const value = useMemo(() => ({ billing, setBilling }), [billing]);
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

/** Page billing period; falls back to local state outside a BillingProvider. */
export function useBilling(): BillingState {
  const shared = useContext(BillingContext);
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  return shared ?? { billing, setBilling };
}
