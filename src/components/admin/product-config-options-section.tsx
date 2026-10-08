"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createProductConfigOption,
  deleteProductConfigOption,
  updateProductConfigOption,
} from "@/lib/actions/admin/product-config-options";
import { toast } from "@/lib/toast";
import type { ProductConfigOption as ProductConfigOptionRow } from "@prisma/client";
import type { Serialized } from "@/lib/money";

/** Config option as sent to the browser (unit prices are numbers). */
type ProductConfigOption = Serialized<ProductConfigOptionRow>;

interface ProductConfigOptionsSectionProps {
  productId: string;
  initialOptions: ProductConfigOption[];
}

const emptyForm = {
  name: "",
  slug: "",
  optionType: "select" as "select" | "quantity",
  choicesJson: '[{"value":"default","label":"Varsayılan","priceMonthly":0,"priceYearly":0}]',
  minValue: "0",
  maxValue: "10",
  unitPrice: "0",
  unitPriceYearly: "0",
  isRequired: false,
};

export function ProductConfigOptionsSection({
  productId,
  initialOptions,
}: ProductConfigOptionsSectionProps) {
  const [options, setOptions] = useState(initialOptions);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsSaving(true);

    try {
      let choices: unknown[] = [];
      if (form.optionType === "select") {
        choices = JSON.parse(form.choicesJson);
        if (!Array.isArray(choices)) {
          throw new Error("Seçenekler JSON dizisi olmalıdır");
        }
      }

      const result = await createProductConfigOption({
        productId,
        name: form.name,
        slug: form.slug,
        optionType: form.optionType,
        choices: form.optionType === "select" ? (choices as never) : [],
        minValue: form.optionType === "quantity" ? Number(form.minValue) : null,
        maxValue: form.optionType === "quantity" ? Number(form.maxValue) : null,
        unitPrice: form.optionType === "quantity" ? Number(form.unitPrice) : 0,
        unitPriceYearly: form.optionType === "quantity" ? Number(form.unitPriceYearly) : 0,
        isRequired: form.isRequired,
      });

      if (!result.success) {
        toast.error(result.error ?? "Seçenek oluşturulamadı");
        return;
      }

      const created = {
        id: result.data?.id ?? crypto.randomUUID(),
        productId,
        name: form.name,
        slug: form.slug,
        optionType: form.optionType,
        choices: form.optionType === "select" ? choices : [],
        minValue: form.optionType === "quantity" ? Number(form.minValue) : null,
        maxValue: form.optionType === "quantity" ? Number(form.maxValue) : null,
        unitPrice: Number(form.unitPrice),
        unitPriceYearly: Number(form.unitPriceYearly),
        isRequired: form.isRequired,
        displayOrder: options.length + 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ProductConfigOption;

      setOptions((prev) => [...prev, created]);
      setForm(emptyForm);
      toast.success("Yapılandırma seçeneği eklendi");
    } catch {
      toast.error("Geçersiz seçenek verisi. JSON formatını kontrol edin.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (option: ProductConfigOption) => {
    const result = await updateProductConfigOption(option.id, { isActive: !option.isActive });
    if (!result.success) {
      toast.error(result.error ?? "Seçenek güncellenemedi");
      return;
    }

    setOptions((prev) =>
      prev.map((item) =>
        item.id === option.id ? { ...item, isActive: !option.isActive } : item
      )
    );
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await deleteProductConfigOption(id);
    setDeletingId(null);

    if (!result.success) {
      toast.error(result.error ?? "Seçenek silinemedi");
      return;
    }

    setOptions((prev) => prev.filter((item) => item.id !== id));
    toast.success("Yapılandırma seçeneği silindi");
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-900 dark:text-white">Yapılandırma Seçenekleri</CardTitle>
          <CardDescription className="text-zinc-400">
            Sipariş sihirbazında gösterilecek ürün seçeneklerini yönetin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {options.length === 0 ? (
            <p className="text-sm text-zinc-500">Henüz yapılandırma seçeneği tanımlanmadı.</p>
          ) : (
            <div className="space-y-3">
              {options.map((option) => (
                <div
                  key={option.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">{option.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {option.slug} · {option.optionType}
                      {option.isRequired ? " · Zorunlu" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-zinc-400">Aktif</Label>
                      <Switch
                        checked={option.isActive}
                        onCheckedChange={() => handleToggleActive(option)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:text-red-400"
                      onClick={() => handleDelete(option.id)}
                      disabled={deletingId === option.id}
                    >
                      {deletingId === option.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-900 dark:text-white">Yeni Seçenek Ekle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Ad</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="PHP Sürümü"
              />
            </div>
            <div className="grid gap-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                placeholder="php-version"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Tip</Label>
            <Select
              value={form.optionType}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, optionType: value as "select" | "quantity" }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="select">Seçim (select)</SelectItem>
                <SelectItem value="quantity">Adet (quantity)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.optionType === "select" ? (
            <div className="grid gap-2">
              <Label>Seçenekler (JSON)</Label>
              <textarea
                className="min-h-28 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm"
                value={form.choicesJson}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, choicesJson: event.target.value }))
                }
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Min</Label>
                <Input
                  type="number"
                  value={form.minValue}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, minValue: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Max</Label>
                <Input
                  type="number"
                  value={form.maxValue}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, maxValue: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Birim Fiyat (Aylık)</Label>
                <Input
                  type="number"
                  value={form.unitPrice}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, unitPrice: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Birim Fiyat (Yıllık)</Label>
                <Input
                  type="number"
                  value={form.unitPriceYearly}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, unitPriceYearly: event.target.value }))
                  }
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>Zorunlu seçenek</Label>
            <Switch
              checked={form.isRequired}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, isRequired: checked }))
              }
            />
          </div>

          <Button onClick={handleCreate} disabled={isSaving || !form.name || !form.slug}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Seçenek Ekle
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}