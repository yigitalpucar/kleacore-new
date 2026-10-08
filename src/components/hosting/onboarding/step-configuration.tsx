"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTRY } from "@/lib/format/price";
import { StepHeading, StepNav, fieldClass } from "./step-shell";
import { calculateConfigurationPrice } from "@/lib/products/configurator-pricing";
import type {
  ConfigurationSelections,
  ProductConfigOptionView,
} from "@/lib/products/configurator-types";
import { toast } from "@/lib/toast";

interface StepConfigurationProps {
  configOptions: ProductConfigOptionView[];
  selections: ConfigurationSelections;
  onSelectionsChange: (selections: ConfigurationSelections) => void;
  onNext: () => void;
  onBack: () => void;
}

function validateSelectionsLocally(
  options: ProductConfigOptionView[],
  selections: ConfigurationSelections
) {
  const errors: string[] = [];

  for (const option of options) {
    const rawValue = selections[option.slug];
    const hasValue = rawValue !== undefined && rawValue !== null && rawValue !== "";

    if (option.isRequired && !hasValue) {
      errors.push(`${option.name} seçimi zorunludur`);
      continue;
    }

    if (!hasValue) {
      continue;
    }

    if (option.optionType === "select") {
      const value = String(rawValue);
      if (!option.choices.some((choice) => choice.value === value)) {
        errors.push(`${option.name} için geçersiz seçim`);
      }
      continue;
    }

    const quantity = Number(rawValue);
    if (!Number.isInteger(quantity)) {
      errors.push(`${option.name} için geçerli bir sayı girin`);
      continue;
    }

    if (option.minValue !== null && quantity < option.minValue) {
      errors.push(`${option.name} en az ${option.minValue} olmalıdır`);
    }

    if (option.maxValue !== null && quantity > option.maxValue) {
      errors.push(`${option.name} en fazla ${option.maxValue} olabilir`);
    }
  }

  return errors;
}

export const StepConfiguration = ({
  configOptions,
  selections,
  onSelectionsChange,
  onNext,
  onBack,
}: StepConfigurationProps) => {
  const [billingPreview] = useState<"monthly" | "yearly">("monthly");

  const pricePreview = useMemo(
    () => calculateConfigurationPrice(configOptions, selections, billingPreview),
    [billingPreview, configOptions, selections]
  );

  const updateSelection = (slug: string, value: string | number | undefined) => {
    const next = { ...selections };
    if (value === undefined || value === "") {
      delete next[slug];
    } else {
      next[slug] = value;
    }
    onSelectionsChange(next);
  };

  const handleNext = () => {
    const errors = validateSelectionsLocally(configOptions, selections);
    if (errors.length > 0) {
      toast.error(errors[0] ?? "Lütfen yapılandırma seçimlerini kontrol edin");
      return;
    }

    onNext();
  };

  return (
    <div className="space-y-8">
      <StepHeading
        eyebrow="Adım · Yapılandırma"
        title="Paketinizi yapılandırın"
        description="Hosting paketinizi ihtiyaçlarınıza göre özelleştirin. Yıldızlı alanlar zorunludur."
      />

      <div className="divide-y divide-dashed rounded-xl border bg-background">
        {configOptions.map((option) => {
          const fieldId = `config-${option.slug}`;
          return (
            <div key={option.id} className="space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <label htmlFor={fieldId} className="text-sm font-medium">
                  {option.name}
                  {option.isRequired ? <span aria-hidden> *</span> : null}
                  {option.isRequired ? <span className="sr-only"> (zorunlu)</span> : null}
                </label>
                {option.optionType === "quantity" && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Birim {formatTRY(option.unitPrice)}/ay
                    {option.minValue !== null || option.maxValue !== null
                      ? ` · ${option.minValue ?? 0}–${option.maxValue ?? "∞"}`
                      : ""}
                  </span>
                )}
              </div>

              {option.optionType === "select" ? (
                <Select
                  value={
                    selections[option.slug] !== undefined
                      ? String(selections[option.slug])
                      : undefined
                  }
                  onValueChange={(value) => updateSelection(option.slug, value)}
                >
                  <SelectTrigger id={fieldId} className="h-11">
                    <SelectValue placeholder={`${option.name} seçin`} />
                  </SelectTrigger>
                  <SelectContent>
                    {option.choices.map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {choice.label}
                        {choice.priceMonthly > 0 ? ` (+${formatTRY(choice.priceMonthly)}/ay)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  id={fieldId}
                  type="number"
                  inputMode="numeric"
                  className={fieldClass}
                  min={option.minValue ?? 0}
                  max={option.maxValue ?? undefined}
                  value={
                    selections[option.slug] !== undefined
                      ? String(selections[option.slug])
                      : ""
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    updateSelection(option.slug, value === "" ? undefined : Number(value));
                  }}
                  placeholder="0"
                />
              )}
            </div>
          );
        })}
      </div>

      {pricePreview.total > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Yapılandırma ek ücreti (aylık önizleme)</span>
          <span className="font-medium tabular-nums">+{formatTRY(pricePreview.total)}</span>
        </div>
      )}

      <StepNav onBack={onBack} onNext={handleNext} />
    </div>
  );
};
