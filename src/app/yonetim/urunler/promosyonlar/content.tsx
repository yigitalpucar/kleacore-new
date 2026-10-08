"use client";

import { useState } from "react";
import { Copy, Edit, Eye, EyeOff, Loader2, Percent, Plus, Tag, Trash2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  EmptyState,
  FormField,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  getStatusOptions,
  type ColumnDef,
} from "@/components/app";
import { CatalogDialog, SwitchField } from "@/components/admin-b/katalog";
import { cn } from "@/lib/utils";
import { formatTRY } from "@/lib/format/price";
import { formatDate } from "@/lib/format/date";
import { createPromotion, deletePromotion, updatePromotion } from "@/lib/actions/admin/promotions";
import { toast } from "@/lib/toast";

interface PromotionData {
  id: string;
  code: string;
  name: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  applicableCategories: string[];
  applicableProducts: string[];
  applicablePeriods: string[];
  maxUses: number;
  maxUsesPerCustomer: number;
  currentUses: number;
  validFrom: string;
  validUntil: string;
  minOrderAmount: number | null;
  isFirstOrderOnly: boolean;
  isNewCustomerOnly: boolean;
  status: "active" | "inactive" | "expired";
  createdAt: string;
  updatedAt: string;
}

interface PromotionFormData {
  code: string;
  name: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxUses: number;
  maxUsesPerCustomer: number;
  validFrom: string;
  validUntil: string;
  minOrderAmount: number;
  isFirstOrderOnly: boolean;
  isNewCustomerOnly: boolean;
}

const defaultFormData: PromotionFormData = {
  code: "",
  name: "",
  description: "",
  discountType: "percentage",
  discountValue: 0,
  maxUses: 0,
  maxUsesPerCustomer: 1,
  validFrom: "",
  validUntil: "",
  minOrderAmount: 0,
  isFirstOrderOnly: false,
  isNewCustomerOnly: false,
};

interface PromotionsContentProps {
  promotions: PromotionData[];
}

export function PromotionsContent({ promotions: initialPromotions }: PromotionsContentProps) {
  const [promotions, setPromotions] = useState(initialPromotions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromotionFormData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleNewPromo = () => {
    setEditingPromo({ ...defaultFormData });
    setEditingId(null);
    setDialogOpen(true);
  };

  const handleEditPromo = (promo: PromotionData) => {
    setEditingPromo({
      code: promo.code,
      name: promo.name,
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      maxUses: promo.maxUses,
      maxUsesPerCustomer: promo.maxUsesPerCustomer,
      validFrom: promo.validFrom.split("T")[0],
      validUntil: promo.validUntil.split("T")[0],
      minOrderAmount: promo.minOrderAmount || 0,
      isFirstOrderOnly: promo.isFirstOrderOnly,
      isNewCustomerOnly: promo.isNewCustomerOnly,
    });
    setEditingId(promo.id);
    setDialogOpen(true);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Promosyon kodu panoya kopyalandı.");
    } catch {
      toast.error("Kod kopyalanamadı.");
    }
  };

  const resolveStatusByDate = (date: string, fallback: "ACTIVE" | "INACTIVE" = "ACTIVE") => {
    return new Date(date).getTime() < Date.now() ? "EXPIRED" : fallback;
  };

  const validatePromotionForm = (data: PromotionFormData) => {
    if (!data.code.trim()) return "Promosyon kodu zorunlu.";
    if (!data.name.trim()) return "Kampanya adı zorunlu.";
    if (data.discountValue <= 0) return "İndirim değeri 0'dan büyük olmalı.";
    if (!data.validFrom || !data.validUntil) return "Başlangıç ve bitiş tarihi zorunlu.";
    if (new Date(data.validFrom).getTime() > new Date(data.validUntil).getTime()) {
      return "Bitiş tarihi başlangıç tarihinden önce olamaz.";
    }
    if (data.maxUsesPerCustomer < 1) return "Müşteri başına kullanım en az 1 olmalı.";
    return null;
  };

  const handleSavePromo = async () => {
    if (!editingPromo || isSaving) return;

    const validationError = validatePromotionForm(editingPromo);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSaving(true);

    const payload = {
      code: editingPromo.code.trim().toUpperCase(),
      name: editingPromo.name.trim(),
      description: editingPromo.description.trim(),
      discountType: editingPromo.discountType === "percentage" ? "PERCENTAGE" as const : "FIXED" as const,
      discountValue: editingPromo.discountValue,
      maxUses: Math.max(0, editingPromo.maxUses || 0),
      maxUsesPerCustomer: Math.max(1, editingPromo.maxUsesPerCustomer || 1),
      validFrom: editingPromo.validFrom,
      validUntil: editingPromo.validUntil,
      minOrderAmount: editingPromo.minOrderAmount > 0 ? editingPromo.minOrderAmount : undefined,
      isFirstOrderOnly: editingPromo.isFirstOrderOnly,
      isNewCustomerOnly: editingPromo.isNewCustomerOnly,
    };

    try {
      if (editingId) {
        const currentPromo = promotions.find((item) => item.id === editingId);
        const computedStatus = resolveStatusByDate(
          payload.validUntil,
          currentPromo?.status === "inactive" ? "INACTIVE" : "ACTIVE"
        );
        const result = await updatePromotion(editingId, {
          ...payload,
          status: computedStatus,
        });

        if (!result.success) {
          toast.error(result.error ?? "Promosyon güncellenemedi.");
          return;
        }

        const nowIso = new Date().toISOString();
        const nextStatus =
          computedStatus === "EXPIRED"
            ? "expired"
            : computedStatus === "INACTIVE"
              ? "inactive"
              : "active";

        setPromotions((prev) =>
          prev.map((promo) =>
            promo.id === editingId
              ? {
                  ...promo,
                  code: payload.code,
                  name: payload.name,
                  description: payload.description,
                  discountType: editingPromo.discountType,
                  discountValue: payload.discountValue,
                  maxUses: payload.maxUses,
                  maxUsesPerCustomer: payload.maxUsesPerCustomer,
                  validFrom: payload.validFrom,
                  validUntil: payload.validUntil,
                  minOrderAmount: payload.minOrderAmount ?? null,
                  isFirstOrderOnly: payload.isFirstOrderOnly,
                  isNewCustomerOnly: payload.isNewCustomerOnly,
                  status: nextStatus,
                  updatedAt: nowIso,
                }
              : promo
          )
        );

        toast.success("Promosyon güncellendi.");
      } else {
        const computedStatus = resolveStatusByDate(payload.validUntil, "ACTIVE");
        const result = await createPromotion({
          ...payload,
          status: computedStatus,
        });

        if (!result.success || !result.data?.id) {
          toast.error(result.error ?? "Promosyon oluşturulamadı.");
          return;
        }

        const nowIso = new Date().toISOString();
        const nextStatus =
          computedStatus === "EXPIRED"
            ? "expired"
            : computedStatus === "INACTIVE"
              ? "inactive"
              : "active";

        setPromotions((prev) => [
          {
            id: result.data.id,
            code: payload.code,
            name: payload.name,
            description: payload.description,
            discountType: editingPromo.discountType,
            discountValue: payload.discountValue,
            applicableCategories: [],
            applicableProducts: [],
            applicablePeriods: [],
            maxUses: payload.maxUses,
            maxUsesPerCustomer: payload.maxUsesPerCustomer,
            currentUses: 0,
            validFrom: payload.validFrom,
            validUntil: payload.validUntil,
            minOrderAmount: payload.minOrderAmount ?? null,
            isFirstOrderOnly: payload.isFirstOrderOnly,
            isNewCustomerOnly: payload.isNewCustomerOnly,
            status: nextStatus,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          ...prev,
        ]);

        toast.success("Promosyon oluşturuldu.");
      }

      setDialogOpen(false);
      setEditingPromo(null);
      setEditingId(null);
    } catch {
      toast.error(editingId ? "Promosyon güncellenemedi." : "Promosyon oluşturulamadı.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (promo: PromotionData) => {
    if (promo.status === "expired") {
      toast.info("Süresi dolmuş promosyonlar doğrudan aktifleştirilemez.");
      return;
    }

    setProcessingId(promo.id);

    try {
      const nextStatus = promo.status === "active" ? "INACTIVE" : "ACTIVE";
      const result = await updatePromotion(promo.id, { status: nextStatus });

      if (!result.success) {
        toast.error(result.error ?? "Promosyon durumu güncellenemedi.");
        return;
      }

      setPromotions((prev) =>
        prev.map((p) =>
          p.id === promo.id
            ? {
                ...p,
                status: nextStatus === "ACTIVE" ? "active" : "inactive",
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );

      toast.success(nextStatus === "ACTIVE" ? "Promosyon aktifleştirildi." : "Promosyon pasife alındı.");
    } catch {
      toast.error("Promosyon durumu güncellenemedi.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeletePromo = async (promo: PromotionData) => {
    const approved = window.confirm(
      `"${promo.code}" promosyon kodunu silmek istediğinize emin misiniz?`
    );
    if (!approved) return;

    setProcessingId(promo.id);

    try {
      const result = await deletePromotion(promo.id);
      if (!result.success) {
        toast.error(result.error ?? "Promosyon silinemedi.");
        return;
      }

      setPromotions((prev) => prev.filter((item) => item.id !== promo.id));
      toast.success("Promosyon silindi.");
    } catch {
      toast.error("Promosyon silinemedi.");
    } finally {
      setProcessingId(null);
    }
  };

  const activeCount = promotions.filter((p) => p.status === "active").length;
  const inactiveCount = promotions.filter((p) => p.status !== "active").length;
  const totalUses = promotions.reduce((sum, p) => sum + p.currentUses, 0);

  const discountLabel = (promo: PromotionData) =>
    promo.discountType === "percentage"
      ? `%${promo.discountValue.toLocaleString("tr-TR")}`
      : formatTRY(promo.discountValue, { keepDecimals: true });

  const statusBadge = (promo: PromotionData) => <StatusBadge kind="promo" status={promo.status.toUpperCase()} />;

  const usage = (promo: PromotionData) => {
    const percent = promo.maxUses > 0 ? Math.min(100, Math.round((promo.currentUses / promo.maxUses) * 100)) : 0;
    return (
      <div className="min-w-[96px] space-y-1.5">
        <p className="text-sm tabular-nums">
          <span className="font-medium">{promo.currentUses.toLocaleString("tr-TR")}</span>
          <span className="text-muted-foreground">
            {promo.maxUses > 0 ? ` / ${promo.maxUses.toLocaleString("tr-TR")}` : " · Sınırsız"}
          </span>
        </p>
        {promo.maxUses > 0 ? (
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={`${promo.code} kullanım oranı`}
            className="h-1 w-24 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full",
                percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-foreground"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}
      </div>
    );
  };

  const codeChip = (promo: PromotionData) => (
    <span className="inline-flex items-center gap-1">
      <code className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[13px] font-medium">{promo.code}</code>
      <button
        type="button"
        onClick={() => handleCopyCode(promo.code)}
        className={appButton({ variant: "ghost", size: "icon-sm", className: "text-muted-foreground hover:text-foreground" })}
        aria-label={`${promo.code} kodunu kopyala`}
      >
        <Copy aria-hidden />
      </button>
    </span>
  );

  const columns: ColumnDef<PromotionData>[] = [
    {
      accessorKey: "code",
      header: "Kod",
      cell: ({ row }) => codeChip(row.original),
    },
    {
      accessorKey: "name",
      header: "Kampanya",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[240px]">
          <p className="truncate font-medium">{row.original.name}</p>
          {row.original.description ? (
            <p className="truncate text-xs text-muted-foreground" title={row.original.description}>
              {row.original.description}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "discountValue",
      header: "İndirim",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium tabular-nums">
          {row.original.discountType === "percentage" ? (
            <Percent aria-hidden className="size-3.5 text-muted-foreground" />
          ) : (
            <Tag aria-hidden className="size-3.5 text-muted-foreground" />
          )}
          {discountLabel(row.original)}
        </span>
      ),
    },
    {
      accessorKey: "currentUses",
      header: "Kullanım",
      cell: ({ row }) => usage(row.original),
    },
    {
      id: "validUntil",
      accessorFn: (p) => p.validUntil,
      header: "Geçerlilik",
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {formatDate(row.original.validFrom)} – {formatDate(row.original.validUntil)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => statusBadge(row.original),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promosyonlar"
        description="İndirim kodlarını oluşturun, kullanım limitlerini ve geçerlilik tarihlerini yönetin."
        actions={
          <button type="button" className={appButton()} onClick={handleNewPromo}>
            <Plus aria-hidden />
            Yeni promosyon
          </button>
        }
      />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard label="Aktif kod" value={activeCount} icon={Tag} hint={`Toplam ${promotions.length} kod`} />
        <StatCard label="Toplam kullanım" value={totalUses.toLocaleString("tr-TR")} icon={Users} hint="Tüm kodlarda" />
        <StatCard
          label="Kullanılamayan"
          value={inactiveCount}
          icon={EyeOff}
          hint="Pasif veya süresi dolmuş kodlar"
        />
      </StatGrid>

      <DataTable
        caption="Promosyon kodları"
        columns={columns}
        data={promotions}
        getRowId={(p) => p.id}
        searchFn={(p, q) =>
          p.code.toLocaleLowerCase("tr-TR").includes(q) || p.name.toLocaleLowerCase("tr-TR").includes(q)
        }
        searchPlaceholder="Kod veya kampanya adı ara…"
        noResultsText="Aramanızla eşleşen promosyon bulunamadı."
        filters={[
          {
            id: "status",
            label: "Durum",
            options: getStatusOptions("promo"),
            getValue: (p) => p.status.toUpperCase(),
          },
        ]}
        rowActions={(p) => {
          const reason = processingId === p.id ? "İşlem sürüyor" : undefined;
          return [
            { label: "Düzenle", icon: <Edit aria-hidden />, onSelect: () => handleEditPromo(p), disabledReason: reason },
            { label: "Kodu kopyala", icon: <Copy aria-hidden />, onSelect: () => handleCopyCode(p.code) },
            ...(p.status !== "expired"
              ? [
                  {
                    label: p.status === "active" ? "Pasif yap" : "Aktif yap",
                    icon: p.status === "active" ? <EyeOff aria-hidden /> : <Eye aria-hidden />,
                    onSelect: () => handleToggleStatus(p),
                    disabledReason: reason,
                    separator: true,
                  },
                ]
              : []),
            {
              label: "Sil",
              icon: <Trash2 aria-hidden />,
              destructive: true,
              separator: true,
              onSelect: () => handleDeletePromo(p),
              disabledReason: reason,
            },
          ];
        }}
        mobileCard={(p) => (
          <ListRow
            title={<span className="font-mono">{p.code}</span>}
            subtitle={p.name}
            trailing={discountLabel(p)}
            meta={
              <>
                {statusBadge(p)}
                <span className="tabular-nums">
                  {p.currentUses.toLocaleString("tr-TR")}
                  {p.maxUses > 0 ? ` / ${p.maxUses.toLocaleString("tr-TR")}` : " · sınırsız"} kullanım
                </span>
                <span className="tabular-nums">Bitiş {formatDate(p.validUntil)}</span>
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={Tag}
            title="Henüz promosyon kodu yok"
            description="İlk indirim kodunuzu oluşturarak kampanya başlatın."
            action={
              <button type="button" className={appButton()} onClick={handleNewPromo}>
                <Plus aria-hidden />
                Yeni promosyon
              </button>
            }
          />
        }
      />

      <CatalogDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        size="lg"
        title={editingId ? "Promosyonu düzenle" : "Yeni promosyon"}
        description={`İndirim kodu bilgilerini ${editingId ? "güncelleyin" : "girin"}.`}
        footer={
          <>
            <button
              type="button"
              className={appButton({ variant: "outline" })}
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              İptal
            </button>
            <button type="button" className={appButton()} onClick={handleSavePromo} disabled={isSaving}>
              {isSaving ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {isSaving ? (editingId ? "Kaydediliyor…" : "Oluşturuluyor…") : editingId ? "Kaydet" : "Oluştur"}
            </button>
          </>
        }
      >
        {editingPromo ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Kod" htmlFor="code" required>
                <Input
                  id="code"
                  value={editingPromo.code}
                  onChange={(e) => setEditingPromo({ ...editingPromo, code: e.target.value.toUpperCase() })}
                  placeholder="YAZ2026"
                  className="font-mono uppercase"
                />
              </FormField>
              <FormField label="Kampanya adı" htmlFor="name" required>
                <Input
                  id="name"
                  value={editingPromo.name}
                  onChange={(e) => setEditingPromo({ ...editingPromo, name: e.target.value })}
                  placeholder="Yaz indirimi"
                />
              </FormField>
            </div>

            <FormField label="Açıklama" htmlFor="description">
              <Textarea
                id="description"
                value={editingPromo.description}
                onChange={(e) => setEditingPromo({ ...editingPromo, description: e.target.value })}
                placeholder="Kampanya açıklaması…"
                className="resize-none"
                rows={2}
              />
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="İndirim tipi" htmlFor="discountType">
                <Select
                  value={editingPromo.discountType}
                  onValueChange={(value) =>
                    setEditingPromo({ ...editingPromo, discountType: value as "percentage" | "fixed" })
                  }
                >
                  <SelectTrigger id="discountType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Yüzde (%)</SelectItem>
                    <SelectItem value="fixed">Sabit tutar (₺)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="İndirim değeri" htmlFor="discountValue" required>
                <Input
                  id="discountValue"
                  type="number"
                  inputMode="decimal"
                  value={editingPromo.discountValue}
                  onChange={(e) =>
                    setEditingPromo({ ...editingPromo, discountValue: parseFloat(e.target.value) || 0 })
                  }
                />
              </FormField>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Başlangıç tarihi" htmlFor="validFrom" required>
                <Input
                  id="validFrom"
                  type="date"
                  value={editingPromo.validFrom}
                  onChange={(e) => setEditingPromo({ ...editingPromo, validFrom: e.target.value })}
                />
              </FormField>
              <FormField label="Bitiş tarihi" htmlFor="validUntil" required>
                <Input
                  id="validUntil"
                  type="date"
                  value={editingPromo.validUntil}
                  onChange={(e) => setEditingPromo({ ...editingPromo, validUntil: e.target.value })}
                />
              </FormField>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Maksimum kullanım" htmlFor="maxUses" hint="0 = sınırsız">
                <Input
                  id="maxUses"
                  type="number"
                  inputMode="numeric"
                  value={editingPromo.maxUses}
                  onChange={(e) => setEditingPromo({ ...editingPromo, maxUses: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </FormField>
              <FormField label="Müşteri başına kullanım" htmlFor="maxUsesPerCustomer">
                <Input
                  id="maxUsesPerCustomer"
                  type="number"
                  inputMode="numeric"
                  value={editingPromo.maxUsesPerCustomer}
                  onChange={(e) =>
                    setEditingPromo({ ...editingPromo, maxUsesPerCustomer: parseInt(e.target.value) || 1 })
                  }
                />
              </FormField>
            </div>

            <FormField label="Minimum sipariş tutarı (₺)" htmlFor="minOrderAmount" hint="Boş veya 0: limit yok.">
              <Input
                id="minOrderAmount"
                type="number"
                inputMode="decimal"
                value={editingPromo.minOrderAmount || ""}
                onChange={(e) =>
                  setEditingPromo({ ...editingPromo, minOrderAmount: parseFloat(e.target.value) || 0 })
                }
                placeholder="0"
                className="sm:max-w-[240px]"
              />
            </FormField>

            <div className="space-y-3">
              <SwitchField
                id="isFirstOrderOnly"
                label="Sadece ilk sipariş"
                description="Kod yalnızca müşterinin ilk siparişinde geçerli olur."
                checked={editingPromo.isFirstOrderOnly}
                onCheckedChange={(checked) => setEditingPromo({ ...editingPromo, isFirstOrderOnly: checked })}
              />
              <SwitchField
                id="isNewCustomerOnly"
                label="Sadece yeni müşteriler"
                description="Kod yalnızca yeni müşteriler tarafından kullanılabilir."
                checked={editingPromo.isNewCustomerOnly}
                onCheckedChange={(checked) => setEditingPromo({ ...editingPromo, isNewCustomerOnly: checked })}
              />
            </div>
          </>
        ) : null}
      </CatalogDialog>
    </div>
  );
}
