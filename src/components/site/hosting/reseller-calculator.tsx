"use client";

import { useId, useMemo, useState } from "react";
import { CornerTicks } from "@/components/site/grid-lines";
import { formatTRY } from "@/lib/format/price";
import { cn } from "@/lib/utils";

export interface ResellerCalcPlan {
  id: string;
  name: string;
  /** VAT-exclusive monthly price (DB). */
  monthlyPrice: number;
  /** cPanel account limit from DB; null = unlimited. */
  accountLimit: number | null;
}

const inputClass =
  "h-11 w-full rounded-lg border bg-background px-3 text-sm tabular-nums shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Simple what-if calculator: customers x your price − plan price.
 * Uses the real plan prices; the customer price is the visitor's own input.
 */
export function ResellerCalculator({ plans, className }: { plans: ResellerCalcPlan[]; className?: string }) {
  const ids = useId();
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [customers, setCustomers] = useState(10);
  const [unitPrice, setUnitPrice] = useState(0);

  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const limit = plan?.accountLimit ?? null;
  const safeCustomers = Math.max(0, Math.min(customers || 0, limit ?? 9999));

  const result = useMemo(() => {
    const revenue = safeCustomers * (unitPrice || 0);
    const cost = plan?.monthlyPrice ?? 0;
    return { revenue, cost, net: revenue - cost };
  }, [safeCustomers, unitPrice, plan]);

  if (!plan) return null;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-background", className)}>
      <CornerTicks />
      <div className="grid md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5 p-6 sm:p-8">
          <div>
            <label htmlFor={`${ids}-plan`} className="text-sm font-medium">
              Reseller paketi
            </label>
            <select
              id={`${ids}-plan`}
              value={plan.id}
              onChange={(event) => setPlanId(event.target.value)}
              className={cn(inputClass, "mt-2")}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatTRY(p.monthlyPrice)}/ay
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              cPanel hesap limiti: {limit === null ? "Sınırsız" : `${limit} hesap`}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={`${ids}-customers`} className="text-sm font-medium">
                Müşteri sayısı
              </label>
              <input
                id={`${ids}-customers`}
                type="number"
                inputMode="numeric"
                min={0}
                max={limit ?? undefined}
                value={customers}
                onChange={(event) => setCustomers(Number(event.target.value))}
                className={cn(inputClass, "mt-2")}
              />
            </div>
            <div>
              <label htmlFor={`${ids}-price`} className="text-sm font-medium">
                Müşteri başına aylık fiyatınız (₺)
              </label>
              <input
                id={`${ids}-price`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="Örn. kendi fiyatınız"
                value={unitPrice || ""}
                onChange={(event) => setUnitPrice(Number(event.target.value))}
                className={cn(inputClass, "mt-2")}
              />
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Fiyatı siz belirlersiniz. Hesap, KDV hariç tutarlarla yapılan basit bir örnektir; vergi,
            alan adı ve diğer giderleriniz dahil değildir.
          </p>
        </div>

        <div className="dark relative border-t bg-neutral-950 p-6 text-foreground sm:p-8 md:border-l md:border-t-0 dark:bg-neutral-900">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Aylık örnek hesap
          </p>
          <dl className="mt-6 space-y-3 text-sm" aria-live="polite">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Müşteri geliri</dt>
              <dd className="font-medium tabular-nums">{formatTRY(result.revenue)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">{plan.name} paket bedeli</dt>
              <dd className="font-medium tabular-nums">−{formatTRY(result.cost)}</dd>
            </div>
            <div className="line-dashed-x my-4" aria-hidden />
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-medium">Fark</dt>
              <dd
                className={cn(
                  "text-3xl font-semibold tabular-nums tracking-tight",
                  result.net < 0 && "text-muted-foreground"
                )}
              >
                {unitPrice > 0 ? formatTRY(result.net) : "—"}
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-xs text-muted-foreground">
            {unitPrice > 0
              ? `${safeCustomers} müşteri × ${formatTRY(unitPrice)} — tutarlar KDV hariçtir.`
              : "Sonucu görmek için müşteri başına aylık fiyatınızı girin."}
          </p>
        </div>
      </div>
    </div>
  );
}
