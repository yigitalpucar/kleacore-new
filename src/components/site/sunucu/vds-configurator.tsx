"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppWindow, Check, Cpu, HardDrive, MemoryStick, Minus, Plus, ShoppingCart, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useCartStore } from "@/store/cart-store";
import { formatTRY } from "@/lib/format/price";
import { checkHostname } from "@/lib/validations/hostname";
import type { ConfigurationSelections, ProductConfigOptionView } from "@/lib/products/configurator-types";
import {
  defaultSelections,
  findOsOption,
  osFamily,
  planForResource,
  quoteVds,
  resourceStops,
  sliderPlans,
  type ResourceKey,
  type VdsPlan,
} from "@/lib/catalog/vds-configurator";
import { BillingSwitch } from "@/components/site/billing-switch";
import { useBilling } from "@/components/site/billing-context";
import { buttonClasses } from "@/components/site/button-classes";
import { FeaturedTag } from "@/components/site/package-comparison";
import { OS_LOGO_PATHS, type OsLogoKey } from "./os-logo-paths";

const RESOURCES: Array<{ key: ResourceKey; label: string; unit: string; icon: typeof Cpu }> = [
  { key: "cpu", label: "İşlemci", unit: "vCPU", icon: Cpu },
  { key: "ram", label: "Bellek", unit: "GB", icon: MemoryStick },
  { key: "disk", label: "NVMe disk", unit: "GB", icon: HardDrive },
];

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(n);

function OsLogo({ family, className }: { family: string; className?: string }) {
  const path = OS_LOGO_PATHS[family as OsLogoKey];
  if (!path) {
    const Fallback = family === "windows" ? AppWindow : TerminalSquare;
    return <Fallback aria-hidden className={className} />;
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d={path} />
    </svg>
  );
}

function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h3 className="flex items-center gap-3 text-base font-semibold tracking-tight">
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full border font-mono text-[11px] text-muted-foreground"
        >
          {n}
        </span>
        {title}
      </h3>
      {hint ? <p className="mt-1.5 pl-9 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * VDS configurator. VDS products have no CPU/RAM/disk configurable options
 * in the DB, so the sliders snap to real packages; OS and other choices come
 * from the selected package's config options. Only the package code, period,
 * selections and hostname go to the cart — checkout prices everything again
 * from the DB, the amounts here are display only.
 */
export function VdsConfigurator({ plans }: { plans: VdsPlan[] }) {
  const router = useRouter();
  const addServerPlan = useCartStore((s) => s.addServerPlan);
  const { billing, setBilling } = useBilling();
  const usable = useMemo(() => sliderPlans(plans), [plans]);
  const initial = usable.find((p) => p.featured) ?? usable[0];

  const [sku, setSku] = useState(initial?.sku ?? "");
  const plan = usable.find((p) => p.sku === sku) ?? initial;
  const [selections, setSelections] = useState<ConfigurationSelections>(() =>
    initial ? defaultSelections(initial.options) : {}
  );
  const [hostname, setHostname] = useState("");
  const [hostnameTouched, setHostnameTouched] = useState(false);
  const ids = useId();

  if (!plan) return null;

  const selectPlan = (next: VdsPlan | undefined) => {
    if (!next || next.sku === plan.sku) return;
    setSku(next.sku);
    setSelections((prev) => defaultSelections(next.options, prev));
  };

  const osOption = findOsOption(plan.options);
  const extraOptions = plan.options.filter((option) => option !== osOption);
  const quote = quoteVds(plan, billing, selections);
  const hostCheck = hostname.trim() ? checkHostname(hostname) : null;
  const hostError = hostCheck && !hostCheck.ok && hostnameTouched ? hostCheck.error : null;
  const hasYearly = usable.some((p) => p.yearlyMonthlyPrice !== null);
  const maxSavings = Math.max(0, ...usable.map((p) => p.savingsPercent));
  const uniformSavings = usable.every((p) => p.savingsPercent === maxSavings);
  let step = 1;

  const setOption = (slug: string, value: string | number | undefined) =>
    setSelections((prev) => {
      const next = { ...prev };
      if (value === undefined || value === "" || value === 0) delete next[slug];
      else next[slug] = value;
      return next;
    });

  const addToCart = () => {
    if (hostCheck && !hostCheck.ok) {
      setHostnameTouched(true);
      document.getElementById(`${ids}-hostname`)?.focus();
      return;
    }
    const labels = quote.options.map((line) => ({ name: line.name, label: line.label }));
    const added = addServerPlan({
      category: "vds",
      planCode: plan.sku,
      title: plan.name,
      price: quote.listedMonthly,
      billingPeriod: quote.period,
      location: "tr",
      configuration: selections,
      configurationLabels: labels,
      configOptionTotal: quote.optionsTotal,
      hostname: hostCheck?.ok ? hostCheck.hostname : undefined,
    });
    if (added) {
      toast.success(`${plan.name} sepete eklendi.`);
      router.push("/sepet");
    } else {
      toast.info("Bu yapılandırma zaten sepetinizde.");
    }
  };

  const periodText = quote.period === "yearly" ? "yıllık" : "aylık";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="divide-y divide-dashed rounded-2xl border bg-background">
        {/* 1 — resources */}
        <section aria-labelledby={`${ids}-res`} className="p-5 sm:p-7">
          <div id={`${ids}-res`}>
            <StepTitle
              n={step++}
              title="Kaynakları seçin"
              hint="Kaydırıcılar yalnızca mevcut paketlerin değerlerinde durur; seçiminizi karşılayan en uygun paket otomatik seçilir."
            />
          </div>
          <div className="space-y-6">
            {RESOURCES.map((resource) => {
              const stops = resourceStops(usable, resource.key);
              const value = plan.resources[resource.key] as number;
              const index = Math.max(0, stops.indexOf(value));
              const Icon = resource.icon;
              const inputId = `${ids}-${resource.key}`;
              return (
                <div key={resource.key}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <label htmlFor={inputId} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon aria-hidden className="size-4" />
                      {resource.label}
                    </label>
                    <span className="text-lg font-semibold tabular-nums">
                      {fmt(value)} <span className="text-sm font-normal text-muted-foreground">{resource.unit}</span>
                    </span>
                  </div>
                  <input
                    id={inputId}
                    type="range"
                    min={0}
                    max={Math.max(0, stops.length - 1)}
                    step={1}
                    value={index}
                    disabled={stops.length < 2}
                    aria-valuetext={`${fmt(value)} ${resource.unit}`}
                    onChange={(event) =>
                      selectPlan(planForResource(usable, resource.key, stops[Number(event.target.value)]))
                    }
                    className="h-6 w-full cursor-pointer accent-foreground disabled:cursor-not-allowed"
                  />
                  <div aria-hidden className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                    {stops.map((stop) => (
                      <span key={stop} className={cn(stop === value && "font-semibold text-foreground")}>
                        {fmt(stop)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <fieldset className="mt-7">
            <legend className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Ya da paketi doğrudan seçin
            </legend>
            <div className="flex flex-wrap gap-2">
              {usable.map((p) => (
                <label
                  key={p.sku}
                  className={cn(
                    "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    p.sku === plan.sku
                      ? "border-foreground bg-foreground text-background"
                      : "text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name={`${ids}-plan`}
                    value={p.sku}
                    checked={p.sku === plan.sku}
                    onChange={() => selectPlan(p)}
                    className="sr-only"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {/* 2 — operating system */}
        {osOption ? (
          <fieldset className="p-5 sm:p-7">
            <legend className="contents">
              <StepTitle n={step++} title={osOption.name} />
            </legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {osOption.choices.map((choice) => {
                const checked = selections[osOption.slug] === choice.value;
                const price = quote.period === "yearly" ? choice.priceYearly : choice.priceMonthly;
                return (
                  <label
                    key={choice.value}
                    className={cn(
                      "relative flex min-h-24 cursor-pointer flex-col items-start gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      checked ? "border-foreground bg-muted/50" : "hover:border-foreground/40"
                    )}
                  >
                    <input
                      type="radio"
                      name={`${ids}-os`}
                      value={choice.value}
                      checked={checked}
                      onChange={() => setOption(osOption.slug, choice.value)}
                      className="sr-only"
                    />
                    <OsLogo family={osFamily(choice)} className="size-7" />
                    <span className="text-sm font-medium leading-snug">{choice.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {price > 0 ? `+${formatTRY(price)}/${quote.period === "yearly" ? "yıl" : "ay"}` : "Ek ücret yok"}
                    </span>
                    {checked ? (
                      <Check aria-hidden className="absolute right-3 top-3 size-4" />
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : plan.fixedOs ? (
          <section className="p-5 sm:p-7">
            <StepTitle n={step++} title="İşletim sistemi" hint="Bu paket aşağıdaki sistemle teslim edilir." />
            <div className="inline-flex items-center gap-3 rounded-xl border border-foreground bg-muted/50 p-4">
              <OsLogo family={osFamily({ value: plan.fixedOs, label: plan.fixedOs })} className="size-7" />
              <span className="text-sm font-medium">{plan.fixedOs}</span>
            </div>
          </section>
        ) : null}

        {/* 3 — other config options of the package */}
        {extraOptions.length > 0 ? (
          <section className="space-y-6 p-5 sm:p-7">
            <StepTitle n={step++} title="Ek seçenekler" />
            {extraOptions.map((option) => (
              <OptionControl
                key={option.id}
                option={option}
                value={selections[option.slug]}
                period={quote.period}
                onChange={(value) => setOption(option.slug, value)}
                idPrefix={ids}
              />
            ))}
          </section>
        ) : null}

        {/* 4 — hostname */}
        <section className="p-5 sm:p-7">
          <StepTitle
            n={step++}
            title="Sunucu adı (hostname)"
            hint="İsteğe bağlı. Boş bırakırsanız kurulumda sunucunuza bir ad atanır."
          />
          <label htmlFor={`${ids}-hostname`} className="sr-only">
            Sunucu adı
          </label>
          <input
            id={`${ids}-hostname`}
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={253}
            placeholder="sunucu1.alanadiniz.com"
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            onBlur={() => setHostnameTouched(true)}
            aria-invalid={hostError ? true : undefined}
            aria-describedby={`${ids}-hostname-help`}
            className={cn(
              "h-11 w-full max-w-md scroll-mb-40 rounded-lg border bg-background px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              hostError && "border-destructive"
            )}
          />
          <p
            id={`${ids}-hostname-help`}
            role={hostError ? "alert" : undefined}
            className={cn("mt-2 text-xs", hostError ? "text-destructive" : "text-muted-foreground")}
          >
            {hostError ?? "Harf, rakam, nokta ve tire; ör. web01 veya web01.alanadiniz.com"}
          </p>
        </section>
      </div>

      {/* Summary */}
      <aside aria-label="Yapılandırma özeti" className="lg:sticky lg:top-24">
        <div className="rounded-2xl bg-neutral-950 p-1.5 text-foreground ring-1 ring-neutral-800 dark dark:bg-neutral-900 dark:ring-white/15">
          <div className="rounded-xl bg-neutral-900 px-5 py-5 dark:bg-neutral-800/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-semibold tracking-tight">{plan.name}</p>
              {plan.featured ? <FeaturedTag /> : null}
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              {plan.specs.map((spec) => (
                <div key={spec.label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{spec.label}</dt>
                  <dd className="text-right font-medium tabular-nums">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="space-y-4 px-5 pb-5 pt-5">
            {hasYearly ? (
              <BillingSwitch
                value={billing}
                onChange={setBilling}
                savingsPercent={maxSavings}
                savingsVaries={!uniformSavings}
                className="justify-start"
              />
            ) : null}
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  Paket{quote.period === "yearly" ? ` (12 × ${formatTRY(quote.listedMonthly)})` : ""}
                </dt>
                <dd className="tabular-nums">{formatTRY(quote.planTotal)}</dd>
              </div>
              {quote.options.map((line) => (
                <div key={line.slug} className="flex justify-between gap-4">
                  <dt className="min-w-0 truncate text-muted-foreground">{line.label}</dt>
                  <dd className="tabular-nums">{line.price > 0 ? formatTRY(line.price) : "Dahil"}</dd>
                </div>
              ))}
              {hostCheck?.ok ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Sunucu adı</dt>
                  <dd className="min-w-0 truncate font-mono text-xs leading-5">{hostCheck.hostname}</dd>
                </div>
              ) : null}
            </dl>
            <div className="border-t border-dashed border-white/15 pt-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {periodText} toplam
              </p>
              <p className="mt-1 flex items-baseline gap-2" aria-live="polite">
                <span className="text-3xl font-semibold tabular-nums tracking-tight">{formatTRY(quote.total)}</span>
                <span className="text-sm text-muted-foreground">+KDV</span>
              </p>
              {quote.period === "yearly" && plan.savingsPercent > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Aylık ödemeye göre paket ücretinde %{plan.savingsPercent} tasarruf
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={addToCart}
              className={buttonClasses({ variant: "inverted", className: "w-full" })}
            >
              <ShoppingCart aria-hidden className="size-4" />
              Sepete ekle
            </button>
            <p className="text-xs text-muted-foreground">
              %20 KDV ödeme adımında eklenir. Nihai tutar sepette paket kayıtlarımızdan yeniden hesaplanır.
            </p>
          </div>
        </div>
      </aside>

      {/* Phones: total + action stay in reach while configuring */}
      <div className="sticky bottom-3 z-20 lg:hidden">
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 pl-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {plan.name} · {periodText}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatTRY(quote.total)} <span className="text-xs font-normal text-muted-foreground">+KDV</span>
            </p>
          </div>
          <button type="button" onClick={addToCart} className={buttonClasses({ className: "shrink-0" })}>
            Sepete ekle
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionControl({
  option,
  value,
  period,
  onChange,
  idPrefix,
}: {
  option: ProductConfigOptionView;
  value: string | number | undefined;
  period: "monthly" | "yearly";
  onChange: (value: string | number | undefined) => void;
  idPrefix: string;
}) {
  const unit = period === "yearly" ? "yıl" : "ay";
  if (option.optionType === "select") {
    return (
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          {option.name}
          {option.isRequired ? null : <span className="ml-1 font-normal text-muted-foreground">(isteğe bağlı)</span>}
        </legend>
        <div className="flex flex-wrap gap-2">
          {option.isRequired ? null : (
            <ChoiceChip
              name={`${idPrefix}-${option.slug}`}
              checked={value === undefined}
              onSelect={() => onChange(undefined)}
              label="Yok"
            />
          )}
          {option.choices.map((choice) => {
            const price = period === "yearly" ? choice.priceYearly : choice.priceMonthly;
            return (
              <ChoiceChip
                key={choice.value}
                name={`${idPrefix}-${option.slug}`}
                checked={value === choice.value}
                onSelect={() => onChange(choice.value)}
                label={choice.label}
                extra={price > 0 ? `+${formatTRY(price)}/${unit}` : undefined}
              />
            );
          })}
        </div>
      </fieldset>
    );
  }

  const min = option.minValue ?? 0;
  const max = option.maxValue ?? 99;
  const current = typeof value === "number" ? value : Number(value ?? min) || min;
  const unitPrice = period === "yearly" ? option.unitPriceYearly : option.unitPrice;
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium" id={`${idPrefix}-${option.slug}-label`}>
          {option.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {unitPrice > 0 ? `Adet başı ${formatTRY(unitPrice)}/${unit}` : "Ek ücret yok"}
        </p>
      </div>
      <div className="inline-flex items-center rounded-full border" role="group" aria-labelledby={`${idPrefix}-${option.slug}-label`}>
        <button
          type="button"
          onClick={() => set(current - 1)}
          disabled={current <= min}
          aria-label={`${option.name} azalt`}
          className="flex size-11 items-center justify-center rounded-full disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <output aria-live="polite" className="w-8 text-center font-medium tabular-nums">
          {current}
        </output>
        <button
          type="button"
          onClick={() => set(current + 1)}
          disabled={current >= max}
          aria-label={`${option.name} artır`}
          className="flex size-11 items-center justify-center rounded-full disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ChoiceChip({
  name,
  checked,
  onSelect,
  label,
  extra,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  extra?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked ? "border-foreground bg-muted/60 font-medium" : "text-muted-foreground hover:border-foreground/40"
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      {label}
      {extra ? <span className="text-xs text-muted-foreground">{extra}</span> : null}
    </label>
  );
}
