"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Percent,
  Tag,
  Calendar,
  Users,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  EyeOff,
  Eye,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import { promoStatusConfig, discountTypeConfig } from "@/lib/products/constants";
import type { PromoCodeStatus } from "@/types/products";
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

const statusButtons = [
  { value: "all", label: "Tümü", icon: Tag },
  { value: "active", label: "Aktif", icon: CheckCircle },
  { value: "inactive", label: "Pasif", icon: Clock },
  { value: "expired", label: "Süresi Dolmuş", icon: XCircle },
];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromotionFormData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredPromotions = promotions.filter((promo) => {
    const matchesSearch =
      promo.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      promo.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || promo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

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
  const totalUses = promotions.reduce((sum, p) => sum + p.currentUses, 0);
  const totalDiscount = promotions.reduce((sum, p) => {
    if (p.discountType === "fixed") {
      return sum + (p.discountValue * p.currentUses);
    }
    return sum + (p.currentUses * 150);
  }, 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Promosyonlar</h1>
            <p className="text-zinc-600 dark:text-zinc-400">İndirim kodlarını yönetin</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10">
              <Tag className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">{promotions.length} Kod</span>
            </div>
            <Button onClick={handleNewPromo} className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Yeni Promosyon
            </Button>
          </div>
        </div>
      </BlurFade>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <BlurFade delay={0.05}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Tag className="h-5 w-5 text-green-500" />
                <span className="text-xs text-green-500">Kullanımda</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{activeCount}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Aktif Kod</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.1}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-xs text-blue-500">Toplam</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{totalUses}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Kullanım</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.15}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                <span className="text-xs text-orange-500">Tahmini</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{formatPrice(totalDiscount)}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">İndirim Tutarı</p>
            </CardContent>
          </Card>
        </BlurFade>
      </div>

      {/* Status Filters */}
      <BlurFade delay={0.2}>
        <div className="flex flex-wrap gap-2">
          {statusButtons.map((btn) => {
            const isActive = statusFilter === btn.value;
            const count = btn.value === "all"
              ? promotions.length
              : promotions.filter((p) => p.status === btn.value).length;

            return (
              <Button
                key={btn.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(btn.value)}
                className={cn(
                  isActive
                    ? "bg-primary hover:bg-primary/90"
                    : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                <btn.icon className="mr-1.5 h-3.5 w-3.5" />
                {btn.label}
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-2",
                    isActive
                      ? "bg-white dark:bg-zinc-900 text-primary"
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  )}
                >
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>
      </BlurFade>

      {/* Search */}
      <BlurFade delay={0.25}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                type="search"
                placeholder="Kod veya kampanya adı ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
              />
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Promotions Table */}
      <BlurFade delay={0.3}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kod</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kampanya</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İndirim</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kullanım</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Geçerlilik</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPromotions.map((promo) => {
                    const statusConf = promoStatusConfig[promo.status as PromoCodeStatus];
                    const discountConf = discountTypeConfig[promo.discountType];
                    const StatusIcon = statusConf?.icon;
                    const usagePercent = promo.maxUses > 0
                      ? Math.round((promo.currentUses / promo.maxUses) * 100)
                      : 0;
                    const isProcessing = processingId === promo.id;

                    return (
                      <tr
                        key={promo.id}
                        className={cn(
                          "border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors",
                          promo.status === "expired" && "opacity-60"
                        )}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                              {promo.code}
                            </code>
                            <button
                              onClick={() => handleCopyCode(promo.code)}
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                              title="Kopyala"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">{promo.name}</p>
                            <p className="text-xs text-zinc-500 line-clamp-1 max-w-[200px]">
                              {promo.description}
                            </p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {promo.discountType === "percentage" ? (
                              <div className="p-1.5 rounded bg-green-500/10">
                                <Percent className="h-3.5 w-3.5 text-green-500" />
                              </div>
                            ) : (
                              <div className="p-1.5 rounded bg-blue-500/10">
                                <Tag className="h-3.5 w-3.5 text-blue-500" />
                              </div>
                            )}
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                              {promo.discountValue}
                              {discountConf.suffix}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                {promo.currentUses}
                              </span>
                              {promo.maxUses > 0 && (
                                <span className="text-xs text-zinc-500">
                                  / {promo.maxUses}
                                </span>
                              )}
                              {promo.maxUses === 0 && (
                                <span className="text-xs text-zinc-500">Sınırsız</span>
                              )}
                            </div>
                            {promo.maxUses > 0 && (
                              <div className="mt-1 w-20 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    usagePercent >= 90
                                      ? "bg-red-500"
                                      : usagePercent >= 70
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                                  )}
                                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDate(promo.validFrom)}</span>
                            <span>-</span>
                            <span>{formatDate(promo.validUntil)}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge
                            className={cn(
                              "gap-1",
                              promo.status === "active" && "bg-green-500/10 text-green-600 dark:text-green-500",
                              promo.status === "inactive" && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500",
                              promo.status === "expired" && "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500"
                            )}
                          >
                            {StatusIcon && <StatusIcon className="h-3 w-3" />}
                            {statusConf?.label}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                              onClick={() => handleEditPromo(promo)}
                              disabled={isProcessing}
                              title="Düzenle"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                  disabled={isProcessing}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                              >
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => handleEditPromo(promo)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Düzenle
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => handleCopyCode(promo.code)}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Kodu Kopyala
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                                {promo.status !== "expired" && (
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => handleToggleStatus(promo)}
                                    disabled={isProcessing}
                                  >
                                    {promo.status === "active" ? (
                                      <>
                                        <EyeOff className="mr-2 h-4 w-4" />
                                        Pasif Yap
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Aktif Yap
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                                <DropdownMenuItem
                                  className="cursor-pointer text-red-500 focus:text-red-500"
                                  onClick={() => handleDeletePromo(promo)}
                                  disabled={isProcessing}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Sil
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredPromotions.length === 0 && (
              <div className="p-8 text-center">
                <Tag className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                  Promosyon bulunamadı
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Arama kriterlerinize uygun promosyon bulunmuyor.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-white">
              {editingId ? "Promosyon Düzenle" : "Yeni Promosyon"}
            </DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
              İndirim kodu bilgilerini {editingId ? "güncelleyin" : "girin"}.
            </DialogDescription>
          </DialogHeader>
          {editingPromo && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code" className="text-zinc-700 dark:text-zinc-300">
                    Kod <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="code"
                    value={editingPromo.code}
                    onChange={(e) =>
                      setEditingPromo({ ...editingPromo, code: e.target.value.toUpperCase() })
                    }
                    placeholder="SUMMER2024"
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white uppercase"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-zinc-700 dark:text-zinc-300">
                    Kampanya Adı <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={editingPromo.name}
                    onChange={(e) =>
                      setEditingPromo({ ...editingPromo, name: e.target.value })
                    }
                    placeholder="Yaz İndirimi"
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description" className="text-zinc-700 dark:text-zinc-300">
                  Açıklama
                </Label>
                <Textarea
                  id="description"
                  value={editingPromo.description}
                  onChange={(e) =>
                    setEditingPromo({ ...editingPromo, description: e.target.value })
                  }
                  placeholder="Kampanya açıklaması..."
                  className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-zinc-700 dark:text-zinc-300">İndirim Tipi</Label>
                  <Select
                    value={editingPromo.discountType}
                    onValueChange={(value) =>
                      setEditingPromo({
                        ...editingPromo,
                        discountType: value as "percentage" | "fixed",
                      })
                    }
                  >
                    <SelectTrigger className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectItem value="percentage">Yüzde (%)</SelectItem>
                      <SelectItem value="fixed">Sabit Tutar (TL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="discountValue" className="text-zinc-700 dark:text-zinc-300">
                    İndirim Değeri
                  </Label>
                  <Input
                    id="discountValue"
                    type="number"
                    value={editingPromo.discountValue}
                    onChange={(e) =>
                      setEditingPromo({
                        ...editingPromo,
                        discountValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="validFrom" className="text-zinc-700 dark:text-zinc-300">
                    Başlangıç Tarihi
                  </Label>
                  <Input
                    id="validFrom"
                    type="date"
                    value={editingPromo.validFrom}
                    onChange={(e) =>
                      setEditingPromo({ ...editingPromo, validFrom: e.target.value })
                    }
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="validUntil" className="text-zinc-700 dark:text-zinc-300">
                    Bitiş Tarihi
                  </Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={editingPromo.validUntil}
                    onChange={(e) =>
                      setEditingPromo({ ...editingPromo, validUntil: e.target.value })
                    }
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="maxUses" className="text-zinc-700 dark:text-zinc-300">
                    Maksimum Kullanım
                  </Label>
                  <Input
                    id="maxUses"
                    type="number"
                    value={editingPromo.maxUses}
                    onChange={(e) =>
                      setEditingPromo({
                        ...editingPromo,
                        maxUses: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="0 = Sınırsız"
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                  <p className="text-xs text-zinc-500">0 = Sınırsız</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxUsesPerCustomer" className="text-zinc-700 dark:text-zinc-300">
                    Müşteri Başına Kullanım
                  </Label>
                  <Input
                    id="maxUsesPerCustomer"
                    type="number"
                    value={editingPromo.maxUsesPerCustomer}
                    onChange={(e) =>
                      setEditingPromo({
                        ...editingPromo,
                        maxUsesPerCustomer: parseInt(e.target.value) || 1,
                      })
                    }
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="minOrderAmount" className="text-zinc-700 dark:text-zinc-300">
                  Minimum Sipariş Tutarı (TL)
                </Label>
                <Input
                  id="minOrderAmount"
                  type="number"
                  value={editingPromo.minOrderAmount || ""}
                  onChange={(e) =>
                    setEditingPromo({
                      ...editingPromo,
                      minOrderAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0 = Limit yok"
                  className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <Label htmlFor="isFirstOrderOnly" className="text-zinc-700 dark:text-zinc-300">
                    Sadece İlk Sipariş
                  </Label>
                  <Switch
                    id="isFirstOrderOnly"
                    checked={editingPromo.isFirstOrderOnly}
                    onCheckedChange={(checked) =>
                      setEditingPromo({ ...editingPromo, isFirstOrderOnly: checked })
                    }
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <Label htmlFor="isNewCustomerOnly" className="text-zinc-700 dark:text-zinc-300">
                    Sadece Yeni Müşteriler
                  </Label>
                  <Switch
                    id="isNewCustomerOnly"
                    checked={editingPromo.isNewCustomerOnly}
                    onCheckedChange={(checked) =>
                      setEditingPromo({ ...editingPromo, isNewCustomerOnly: checked })
                    }
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
              className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              İptal
            </Button>
            <Button onClick={handleSavePromo} disabled={isSaving} className="bg-primary hover:bg-primary/90">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? (editingId ? "Kaydediliyor..." : "Oluşturuluyor...") : (editingId ? "Kaydet" : "Oluştur")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
