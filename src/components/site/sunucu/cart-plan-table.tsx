"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatTRY, yearlySavingsPercent, type BillingPeriod } from "@/lib/format/price";
import { periodTotal } from "@/lib/billing/period-price";
import { useCartStore } from "@/store/cart-store";
import { toast } from "@/lib/toast";
import { BillingSwitch } from "@/components/site/billing-switch";
import { useBilling } from "@/components/site/billing-context";
import { FeaturedTag } from "@/components/site/package-comparison";
import { buttonClasses } from "@/components/site/button-classes";
import { Price } from "@/components/site/price";
import type { CartTarget } from "./cart-target";

export interface CartPlanColumn {
  key: string;
  label: string;
  /** Optional second line under the value (e.g. cores under the CPU model). */
  subKey?: string;
}

/** Serializable plan row (same shape as the kit's ServerPlanRow, without href). */
export interface CartPlanRow {
  id: string;
  name: string;
  featured?: boolean;
  specs: Record<string, string>;
  monthlyPrice: number;
  yearlyMonthlyPrice?: number | null;
}

/**
 * Plan table with an add-to-cart action — a local variant of the kit's
 * ServerPlanTable (which only supports links). A real table from `lg`,
 * stacked cards below, never scrolls horizontally.
 */
export function CartPlanTable({
  plans,
  columns,
  target,
  caption,
  ctaLabel = "Satın al",
  showBillingSwitch = true,
  className,
}: {
  plans: CartPlanRow[];
  columns: CartPlanColumn[];
  target: CartTarget;
  caption: string;
  ctaLabel?: string;
  showBillingSwitch?: boolean;
  className?: string;
}) {
  const { billing, setBilling } = useBilling();
  const yearlyAvailable = showBillingSwitch && plans.some((p) => p.yearlyMonthlyPrice);
  const savingsList = plans.map((p) => yearlySavingsPercent(p.monthlyPrice, p.yearlyMonthlyPrice));
  const savings = yearlyAvailable ? Math.max(0, ...savingsList) : 0;
  const savingsUniform = savingsList.every((v) => v === savings);
  const add = useCartPlanAdd(target, billing);

  const priceOf = (plan: CartPlanRow) =>
    billing === "yearly" && plan.yearlyMonthlyPrice ? plan.yearlyMonthlyPrice : plan.monthlyPrice;

  const yearlyNote = (plan: CartPlanRow) => {
    if (billing !== "yearly" || !plan.yearlyMonthlyPrice) return null;
    const pct = yearlySavingsPercent(plan.monthlyPrice, plan.yearlyMonthlyPrice);
    return (
      <span className="mt-1 block text-[11px] text-muted-foreground">
        {formatTRY(periodTotal(plan.yearlyMonthlyPrice, "yearly", "monthly-equivalent"))}/yıl
        {pct > 0 ? <> · %{pct} tasarruf</> : null}
      </span>
    );
  };

  const cell = (plan: CartPlanRow, col: CartPlanColumn) => (
    <>
      <span className="block font-medium">{plan.specs[col.key] || "—"}</span>
      {col.subKey && plan.specs[col.subKey] ? (
        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
          {plan.specs[col.subKey]}
        </span>
      ) : null}
    </>
  );

  const action = (plan: CartPlanRow, size: "sm" | "md") => (
    <button
      type="button"
      onClick={() => add(plan)}
      className={buttonClasses({
        variant: plan.featured ? "primary" : "outline",
        size,
        className: size === "sm" ? "min-h-11 px-4" : "w-full sm:w-auto",
      })}
      aria-label={`${plan.name} paketini satın al`}
    >
      {ctaLabel}
    </button>
  );

  return (
    <div className={className}>
      {yearlyAvailable ? (
        <BillingSwitch
          value={billing}
          onChange={setBilling}
          savingsPercent={savings}
          savingsVaries={!savingsUniform}
          className="mb-10"
        />
      ) : null}

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-xl border bg-background lg:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b bg-muted/40 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th scope="col" className="px-5 py-3 font-medium">Paket</th>
              {columns.map((col) => (
                <th key={col.key} scope="col" className="px-4 py-3 font-medium">
                  {col.label}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-medium">Fiyat</th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">İşlem</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr
                key={plan.id}
                className={cn(
                  "border-b border-dashed transition-colors last:border-b-0 hover:bg-muted/30",
                  plan.featured && "bg-muted/40"
                )}
              >
                <th scope="row" className="px-5 py-4 text-left font-semibold">
                  <span className="flex flex-wrap items-center gap-2">
                    {plan.name}
                    {plan.featured ? <FeaturedTag /> : null}
                  </span>
                </th>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-4 tabular-nums">
                    {cell(plan, col)}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-4 text-right">
                  <Price amount={priceOf(plan)} period="ay" size="md" className="justify-end" />
                  {yearlyNote(plan)}
                </td>
                <td className="px-5 py-4 text-right">{action(plan, "sm")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone / tablet: cards */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:hidden" aria-label={caption}>
        {plans.map((plan) => (
          <li
            key={plan.id}
            className={cn(
              "flex flex-col rounded-xl border bg-background p-4",
              plan.featured && "ring-1 ring-foreground/25"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{plan.name}</h3>
              {plan.featured ? <FeaturedTag /> : null}
            </div>
            <dl className="mt-3 grid flex-1 grid-cols-2 content-start gap-x-4 gap-y-3 text-sm">
              {columns.map((col) => (
                <div key={col.key} className="min-w-0">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </dt>
                  <dd className="break-words">{cell(plan, col)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-4">
              <div>
                <Price amount={priceOf(plan)} period="ay" size="md" />
                {yearlyNote(plan)}
              </div>
              {action(plan, "md")}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-muted-foreground">
        {billing === "yearly" ? "Yıllık ödemede aylık karşılığı gösterilir. " : ""}
        Fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir.
      </p>
    </div>
  );
}

/**
 * Add-to-cart for a server/datacenter plan in the given billing period. Only
 * the plan code and period matter to checkout, which re-prices from the DB;
 * the price passed here is what the cart shows until then.
 */
export function useCartPlanAdd(target: CartTarget, billing: BillingPeriod) {
  const router = useRouter();
  const addServerPlan = useCartStore((s) => s.addServerPlan);
  const addProduct = useCartStore((s) => s.addProduct);

  return (plan: Pick<CartPlanRow, "id" | "name" | "monthlyPrice" | "yearlyMonthlyPrice">) => {
    const yearly = billing === "yearly" && Boolean(plan.yearlyMonthlyPrice);
    const price = yearly ? (plan.yearlyMonthlyPrice as number) : plan.monthlyPrice;
    const period: BillingPeriod = yearly ? "yearly" : "monthly";
    const added =
      target.kind === "server"
        ? addServerPlan({
            category: target.category,
            planCode: plan.id,
            title: plan.name,
            price,
            billingPeriod: period,
            location: "tr",
          })
        : addProduct({
            type: "datacenter",
            sku: plan.id,
            title: plan.name,
            price,
            billingPeriod: "monthly",
            subType: target.subType,
          });
    if (added) {
      toast.success(`${plan.name} sepete eklendi.`);
      router.push("/sepet");
    } else {
      toast.info("Bu ürün zaten sepetinizde.");
    }
  };
}
