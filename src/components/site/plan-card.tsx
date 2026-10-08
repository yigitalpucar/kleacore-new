import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { type BillingPeriod, yearlySavingsPercent } from "@/lib/format/price";
import { buttonClasses } from "./button-classes";
import { GridLineHorizontal } from "./grid-lines";
import { resolveIcon, type IconRef } from "./icon";
import { Price } from "./price";

export interface PlanSpec {
  label: string;
  value: string;
  icon?: IconRef;
  highlight?: boolean;
}

/**
 * Serializable plan shape for PlanCard / PlanGrid.
 * Build it from DB products with `productToPlanCard()` (src/lib/products/map-product.ts).
 */
export interface PlanCardData {
  id: string;
  name: string;
  description?: string;
  /** VAT-exclusive price when billed monthly. */
  monthlyPrice: number;
  /** VAT-exclusive monthly equivalent when billed yearly (yearly tier). */
  yearlyMonthlyPrice?: number | null;
  /** Renders the dark "featured" card. Use for the DB `isPopular` plan only. */
  featured?: boolean;
  /** Short label on the card (e.g. "En çok tercih edilen"). */
  badge?: string;
  /** Key/value rows (disk, trafik…). */
  specs?: PlanSpec[];
  /** Check-list items. */
  features?: string[];
  cta: { label?: string; href: string };
}

export function PlanCard({
  plan,
  billing = "monthly",
  className,
}: {
  plan: PlanCardData;
  billing?: BillingPeriod;
  className?: string;
}) {
  const yearlyAvailable = Boolean(plan.yearlyMonthlyPrice);
  const showYearly = billing === "yearly" && yearlyAvailable;
  const amount = showYearly ? (plan.yearlyMonthlyPrice as number) : plan.monthlyPrice;
  const savings = showYearly ? yearlySavingsPercent(plan.monthlyPrice, plan.yearlyMonthlyPrice) : 0;
  const featured = Boolean(plan.featured);
  const badge = plan.badge ?? (featured ? "Popüler" : undefined);

  return (
    <article
      className={cn(
        // Featured card is always dark (in both themes) via the `dark` scope.
        "relative flex h-full flex-col rounded-2xl p-1.5",
        featured
          ? "dark bg-neutral-950 text-foreground ring-1 ring-neutral-800 dark:bg-neutral-900 dark:ring-white/15"
          : "bg-muted/60 ring-1 ring-border dark:bg-muted/30",
        className
      )}
      aria-labelledby={`plan-${plan.id}`}
    >
      <div
        className={cn(
          "rounded-xl px-5 py-5 sm:px-6",
          featured
            ? "bg-neutral-900 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] dark:bg-neutral-800/70"
            : "bg-background shadow-[0_6px_10px_-6px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <h3 id={`plan-${plan.id}`} className="text-lg font-semibold tracking-tight">
            {plan.name}
          </h3>
          {badge ? (
            <span className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </div>
        {plan.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-6 sm:px-6">
        <Price amount={amount} period="ay" size="lg" />
        <p className="mt-2 min-h-5 text-xs text-muted-foreground">
          {showYearly ? (
            <>
              Yıllık ödemede aylık karşılığı
              {savings > 0 ? <> · aylığa göre %{savings} tasarruf</> : null}
            </>
          ) : billing === "yearly" && !yearlyAvailable ? (
            "Bu pakette yalnızca aylık ödeme var"
          ) : (
            "Aylık faturalandırılır"
          )}
        </p>

        <Link
          href={plan.cta.href}
          className={buttonClasses({
            variant: featured ? "inverted" : "primary",
            className: "mt-5 w-full",
          })}
          aria-label={`${plan.name} paketini seç`}
        >
          {plan.cta.label ?? "Paketi seç"}
        </Link>

        {(plan.specs?.length || plan.features?.length) ? (
          <>
            <GridLineHorizontal className="relative my-6" fade={false} />
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Pakete dahil
            </p>
          </>
        ) : null}

        {plan.specs?.length ? (
          <dl className="mt-4 space-y-2.5 text-sm">
            {plan.specs.map((spec) => {
              const Icon = resolveIcon(spec.icon);
              return (
                <div key={spec.label} className="flex items-center justify-between gap-4">
                  <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    {Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
                    <span className="truncate">{spec.label}</span>
                  </dt>
                  <dd className={cn("text-right font-medium tabular-nums", spec.highlight && "text-foreground")}>
                    {spec.value}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}

        {plan.features?.length ? (
          <ul className="mt-4 space-y-2.5 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted"
                >
                  <Check className="size-2.5 stroke-[3]" />
                </span>
                <span className="text-foreground/90">{feature}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
