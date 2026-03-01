"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/utils/icon-map";
import type { ProductAddon } from "@prisma/client";
import type { SelectedAddon } from "@/app/hosting/satin-al/[slug]/content";

interface StepAddonsProps {
  addons: ProductAddon[];
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

  const toggleAddon = (addon: ProductAddon) => {
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Ek Hizmetler</h2>
        <p className="text-sm text-muted-foreground">
          Hosting paketinizi güçlendirmek için ek hizmetler seçin.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {addons.map((addon) => {
          const Icon = getIcon(addon.icon);
          const checked = isSelected(addon.sku);

          return (
            <Card
              key={addon.sku}
              className={cn(
                "transition-all cursor-pointer hover:shadow-md",
                checked && "ring-2 ring-primary",
                addon.isRequired && "opacity-80"
              )}
              onClick={() => toggleAddon(addon)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{addon.name}</span>
                        {addon.isPopular && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {addon.badge || "Popüler"}
                          </Badge>
                        )}
                        {addon.isRequired && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            Zorunlu
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {addon.description}
                      </p>
                      <p className="text-sm font-medium text-primary mt-1">
                        ₺{addon.monthlyPrice}/ay
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={checked}
                    disabled={addon.isRequired}
                    onCheckedChange={() => toggleAddon(addon)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {addons.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Bu paket için ek hizmet bulunmuyor.
        </p>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>
        <Button onClick={onNext}>
          Devam Et
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
