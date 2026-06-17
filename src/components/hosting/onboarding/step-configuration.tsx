"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Yapılandırma</h2>
        <p className="text-sm text-muted-foreground">
          Hosting paketinizi ihtiyaçlarınıza göre özelleştirin.
        </p>
      </div>

      <div className="space-y-4">
        {configOptions.map((option) => (
          <Card key={option.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">
                  {option.name}
                  {option.isRequired ? " *" : ""}
                </Label>
                {option.optionType === "quantity" && (
                  <span className="text-xs text-muted-foreground">
                    ₺{option.unitPrice}/ay
                    {option.minValue !== null || option.maxValue !== null
                      ? ` (${option.minValue ?? 0}-${option.maxValue ?? "∞"})`
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
                  <SelectTrigger>
                    <SelectValue placeholder={`${option.name} seçin`} />
                  </SelectTrigger>
                  <SelectContent>
                    {option.choices.map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {choice.label}
                        {choice.priceMonthly > 0 ? ` (+₺${choice.priceMonthly}/ay)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
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
            </CardContent>
          </Card>
        ))}
      </div>

      {pricePreview.total > 0 && (
        <div
          className={cn(
            "rounded-lg border bg-muted/40 px-4 py-3 text-sm flex items-center justify-between"
          )}
        >
          <span className="text-muted-foreground">Yapılandırma ek ücreti (aylık önizleme)</span>
          <span className="font-medium text-primary">+₺{pricePreview.total.toFixed(2)}</span>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>
        <Button onClick={handleNext}>
          Devam Et
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};