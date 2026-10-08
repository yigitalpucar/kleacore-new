"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/site/button-classes";
import { GridLineHorizontal } from "@/components/site/grid-lines";
import { Price } from "@/components/site/price";
import { toast } from "@/lib/toast";
import { useCartStore } from "@/store/cart-store";
import type { SslPlan } from "./ssl-plan";

/**
 * SSL certificate cards (yearly price). Same look as the kit PlanCard; the
 * CTA adds the certificate to the cart exactly like the previous pages did,
 * or links to the contact form for quote-only (unpriced) packages.
 */
export function SslPlanGrid({
  plans,
  subType,
  emptyMessage = "Bu kategoride şu anda satışta sertifika bulunmuyor.",
  className,
}: {
  plans: SslPlan[];
  /** Cart `subType` (standart | wildcard | ev | kurumsal). */
  subType: string;
  emptyMessage?: string;
  className?: string;
}) {
  const addProduct = useCartStore((s) => s.addProduct);
  const router = useRouter();

  if (plans.length === 0) {
    return (
      <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  const cols =
    plans.length >= 3 ? "md:grid-cols-2 lg:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2" : "max-w-md";

  const handleBuy = (plan: SslPlan) => {
    const added = addProduct({
      type: "ssl",
      sku: plan.sku,
      title: plan.name,
      price: plan.price,
      billingPeriod: "yearly",
      subType,
    });
    if (added) {
      toast.success(`${plan.name} sepete eklendi.`);
      router.push("/sepet");
    } else {
      toast.info("Bu ürün zaten sepetinizde.");
    }
  };

  return (
    <div className={cn("grid grid-cols-1 gap-4 lg:gap-6", cols, plans.length === 1 && "mx-auto w-full", className)}>
      {plans.map((plan) => {
        const featured = plan.featured;
        const specs = [
          plan.validationType ? { label: "Doğrulama", value: plan.validationType } : null,
          plan.validationTime ? { label: "Doğrulama süresi", value: plan.validationTime } : null,
          plan.domains ? { label: "Alan adı", value: plan.domains } : null,
          plan.sslCount ? { label: "Sertifika sayısı", value: plan.sslCount } : null,
          plan.warranty ? { label: "Garanti", value: plan.warranty } : null,
        ].filter((s): s is { label: string; value: string } => s !== null);
        const headingId = `ssl-${plan.sku}`;

        return (
          <article
            key={plan.sku}
            aria-labelledby={headingId}
            className={cn(
              "relative flex h-full flex-col rounded-2xl p-1.5",
              featured
                ? "dark bg-neutral-950 text-foreground ring-1 ring-neutral-800 dark:bg-neutral-900 dark:ring-white/15"
                : "bg-muted/60 ring-1 ring-border dark:bg-muted/30"
            )}
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
                <h3 id={headingId} className="text-lg font-semibold tracking-tight">
                  {plan.name}
                </h3>
                {featured ? (
                  <span className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Popüler
                  </span>
                ) : null}
              </div>
              {plan.description ? <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p> : null}
            </div>

            <div className="flex flex-1 flex-col px-5 pb-5 pt-6 sm:px-6">
              {plan.quoteOnly ? (
                <>
                  <p className="text-2xl font-semibold tracking-tight">Size özel fiyat</p>
                  <p className="mt-2 min-h-5 text-xs text-muted-foreground">
                    Sertifika sayısı ve türüne göre teklif hazırlanır
                  </p>
                  <Link
                    href={`/iletisim?konu=${encodeURIComponent(`Kurumsal SSL teklifi: ${plan.name}`)}`}
                    className={buttonClasses({ variant: featured ? "inverted" : "primary", className: "mt-5 w-full" })}
                    aria-label={`${plan.name} için teklif alın`}
                  >
                    Teklif alın
                  </Link>
                </>
              ) : (
                <>
                  <Price amount={plan.price} period="yıl" size="lg" />
                  <p className="mt-2 min-h-5 text-xs text-muted-foreground">Yıllık faturalandırılır</p>
                  <button
                    type="button"
                    onClick={() => handleBuy(plan)}
                    className={buttonClasses({ variant: featured ? "inverted" : "primary", className: "mt-5 w-full" })}
                    aria-label={`${plan.name} sertifikasını sepete ekle`}
                  >
                    Sepete ekle
                  </button>
                </>
              )}

              {specs.length || plan.features.length ? (
                <>
                  <GridLineHorizontal className="relative my-6" fade={false} />
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Sertifika bilgileri
                  </p>
                </>
              ) : null}

              {specs.length ? (
                <dl className="mt-4 space-y-2.5 text-sm">
                  {specs.map((spec) => (
                    <div key={spec.label} className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">{spec.label}</dt>
                      <dd className="text-right font-medium tabular-nums">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {plan.features.length ? (
                <ul className="mt-4 space-y-2.5 border-t border-dashed pt-4 text-sm">
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
      })}
    </div>
  );
}
