"use client";

import {
  DatabaseBackup,
  Globe,
  ScanSearch,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { formatTRY } from "@/lib/format/price";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/utils/icon-map";
import { ChoiceTile, StepHeading, StepNav } from "./step-shell";
import type { AddonView, SelectedAddon } from "@/app/hosting/satin-al/[slug]/content";

interface StepAddonsProps {
  addons: AddonView[];
  selectedAddons: SelectedAddon[];
  onSelectedAddons: (addons: SelectedAddon[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const StepAddons = ({
  addons,
  selectedAddons,
  onSelectedAddons,
  onNext,
  onBack,
}: StepAddonsProps) => {
  const isSelected = (sku: string) => selectedAddons.some((a) => a.sku === sku);

  const toggleAddon = (addon: AddonView) => {
    if (addon.isRequired) return;

    if (isSelected(addon.sku)) {
      onSelectedAddons(selectedAddons.filter((a) => a.sku !== addon.sku));
    } else {
      onSelectedAddons([
        ...selectedAddons,
        {
          sku: addon.sku,
          name: addon.name,
          monthlyPrice: addon.monthlyPrice,
          yearlyPrice: addon.yearlyPrice,
        },
      ]);
    }
  };

  return (
    <div className="space-y-8">
      <StepHeading
        eyebrow="Adım · Ek hizmetler"
        title="Ek hizmet ekleyin"
        description="İsteğe bağlı ek hizmetleri seçin. Fiyatlar aylık olarak gösterilir; yıllık ödemede tutar özet adımında güncellenir."
      />

      {addons.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addons.map((addon) => {
            const Icon = ADDON_ICONS[addon.icon] ?? getIcon(addon.icon);
            const checked = isSelected(addon.sku);

            return (
              <li key={addon.sku}>
                <ChoiceTile
                  selected={checked}
                  disabled={addon.isRequired}
                  onClick={() => toggleAddon(addon)}
                  className="h-full"
                >
                  <span className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                      <Icon aria-hidden className="size-4 text-foreground/80" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{addon.name}</span>
                        {addon.isRequired ? (
                          <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Zorunlu
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                        {addon.description}
                      </span>
                      <span className="mt-2 block text-sm font-medium tabular-nums">
                        +{formatTRY(addon.monthlyPrice)}
                        <span className="font-normal text-muted-foreground">/ay</span>
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors",
                        checked ? "border-foreground bg-foreground" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-3.5 rounded-full bg-background shadow transition-transform",
                          checked ? "translate-x-[18px]" : "translate-x-0.5"
                        )}
                      />
                    </span>
                  </span>
                </ChoiceTile>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Bu paket için ek hizmet bulunmuyor.
        </p>
      )}

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
};

const ADDON_ICONS: Record<string, LucideIcon> = {
  DatabaseBackup,
  ShieldCheck,
  ScanSearch,
  Zap,
  Globe,
};
