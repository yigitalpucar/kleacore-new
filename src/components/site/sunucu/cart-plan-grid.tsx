"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { toast } from "@/lib/toast";
import { buttonClasses } from "@/components/site/button-classes";
import { GridLineHorizontal } from "@/components/site/grid-lines";
import { resolveIcon } from "@/components/site/icon";
import { Price } from "@/components/site/price";
import type { PlanCardData } from "@/components/site/plan-card";

/**
 * Monthly plan cards with an add-to-cart button — a local variant of the
 * kit's PlanCard/PlanGrid (which only support links). Same visual language:
 * muted shell, dark featured card for the DB `isPopular` plan.
 */
export function CartPlanGrid({
  plans,
  subType,
  ctaLabel = "Sipariş ver",
  className,
}: {
  plans: PlanCardData[];
  /** Cart `subType` for datacenter products (e.g. "barindirma"). */
  subType: string;
  ctaLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const addProduct = useCartStore((s) => s.addProduct);

  const add = (plan: PlanCardData) => {
    const added = addProduct({
      type: "datacenter",
      sku: plan.id,
      title: plan.name,
      price: plan.monthlyPrice,
      billingPeriod: "monthly",
      subType,
    });
    if (added) {
      toast.success(`${plan.name} sepete eklendi.`);
      router.push("/sepet");
    } else {
      toast.info("Bu ürün zaten sepetinizde.");
    }
  };

  const cols =
    plans.length >= 4 ? "lg:grid-cols-4" : plans.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2 lg:max-w-4xl lg:mx-auto";

  if (plans.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Şu anda satışta paket bulunmuyor. Bilgi için support@kleacore.com adresine yazabilirsiniz.
      </p>
    );
  }

  return (
    <div className={className}>
      <ul className={cn("grid gap-4 sm:grid-cols-2", cols)}>
        {plans.map((plan) => {
          const featured = Boolean(plan.featured);
          const badge = featured ? "Popüler" : plan.badge;
          return (
            <li key={plan.id}>
              <article
                aria-labelledby={`plan-${plan.id}`}
                className={cn(
                  "relative flex h-full flex-col rounded-2xl p-1.5",
                  featured
                    ? "dark bg-neutral-950 text-foreground ring-1 ring-neutral-800 dark:bg-neutral-900 dark:ring-white/15"
                    : "bg-muted/60 ring-1 ring-border dark:bg-muted/30"
                )}
              >
                <div
                  className={cn(
                    "rounded-xl px-5 py-5",
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

                <div className="flex flex-1 flex-col px-5 pb-5 pt-6">
                  <Price amount={plan.monthlyPrice} period="ay" size="lg" />
                  <p className="mt-2 text-xs text-muted-foreground">Aylık faturalandırılır</p>

                  <button
                    type="button"
                    onClick={() => add(plan)}
                    className={buttonClasses({
                      variant: featured ? "inverted" : "primary",
                      className: "mt-5 w-full",
                    })}
                    aria-label={`${plan.name} için sipariş ver`}
                  >
                    {ctaLabel}
                  </button>

                  {plan.specs?.length || plan.features?.length ? (
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
                            <dd className="text-right font-medium tabular-nums">{spec.value}</dd>
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
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir.
      </p>
    </div>
  );
}
