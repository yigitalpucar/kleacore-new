"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ScrollText,
  Users,
  Shield,
  User,
  Calendar,
  Globe,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import type { Prisma } from "@prisma/client";

interface ActivityLogUser {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: string;
}

interface ActivityLogItem {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: Prisma.JsonValue | null;
  ipAddress: string | null;
  createdAt: Date;
  user: ActivityLogUser;
}

interface Stats {
  total: number;
  todayCount: number;
  adminCount: number;
  customerCount: number;
}

interface FilterOptions {
  entities: string[];
  actions: string[];
}

interface ActivityUser {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: string;
}

interface Filters {
  userId: string;
  entity: string;
  action: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

interface AktiviteContentProps {
  data: ActivityLogItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  stats: Stats;
  filterOptions: FilterOptions;
  activityUsers: ActivityUser[];
  filters: Filters;
}

const actionLabels: Record<string, string> = {
  LOGIN: "Giriş",
  LOGIN_FAILED: "Başarısız Giriş",
  UPDATE_SETTINGS: "Ayar Güncelleme",
  APPROVE_ORDER: "Sipariş Onayı",
  CREATE_ORDER: "Sipariş Oluşturma",
  UPDATE_PROFILE: "Profil Güncelleme",
  CREATE_TICKET: "Destek Talebi",
  SUSPEND_SERVICE: "Hizmet Askıya Alma",
  INVOICE_PAID: "Fatura Ödeme",
  CREATE_CUSTOMER: "Müşteri Oluşturma",
  ORDER_STATUS_CHANGE: "Sipariş Durum Değişikliği",
};

const entityLabels: Record<string, string> = {
  Session: "Oturum",
  Setting: "Ayar",
  Order: "Sipariş",
  User: "Kullanıcı",
  SupportTicket: "Destek Talebi",
  Service: "Hizmet",
  Invoice: "Fatura",
};

function formatAction(action: string) {
  return actionLabels[action] ?? action.replace(/_/g, " ");
}

function formatEntity(entity: string) {
  return entityLabels[entity] ?? entity;
}

function formatDetails(details: Prisma.JsonValue | null) {
  if (details === null || details === undefined) {
    return "-";
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details, null, 0);
  } catch {
    return String(details);
  }
}

function getEntityLink(entity: string, entityId: string | null) {
  if (!entityId) {
    return null;
  }

  switch (entity) {
    case "Order":
      return `/yonetim/siparisler/${entityId}`;
    case "Invoice":
      return `/yonetim/faturalar/${entityId}`;
    case "Service":
      return `/yonetim/hizmetler/${entityId}`;
    case "User":
      return `/yonetim/musteriler/${entityId}`;
    case "SupportTicket":
      return `/yonetim/destek`;
    default:
      return null;
  }
}

export function AktiviteContent({
  data,
  total,
  page,
  totalPages,
  stats,
  filterOptions,
  activityUsers,
  filters,
}: AktiviteContentProps) {
  const router = useRouter();
  const searchParamsHook = useSearchParams();

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParamsHook.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") {
      params.set("page", "1");
    }
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push("/yonetim/aktivite");
  };

  const hasActiveFilters =
    filters.userId ||
    filters.entity ||
    filters.action ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.search;

  const statsCards = [
    {
      title: "Toplam Kayıt",
      value: stats.total,
      icon: ScrollText,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Bugün",
      value: stats.todayCount,
      icon: Calendar,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Admin İşlemleri",
      value: stats.adminCount,
      icon: Shield,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Müşteri İşlemleri",
      value: stats.customerCount,
      icon: Users,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Aktivite Logları</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Sistemdeki kullanıcı ve admin işlemlerinin kaydı
          </p>
        </div>
      </BlurFade>

      <BlurFade delay={0.05}>
        <div className="grid gap-4 md:grid-cols-4">
          {statsCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.title}
                className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        stat.bgColor
                      )}
                    >
                      <Icon className={cn("h-5 w-5", stat.color)} />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{stat.title}</p>
                      <p className="text-xl font-bold text-zinc-900 dark:text-white">
                        {stat.value.toLocaleString("tr-TR")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <Filter className="h-4 w-4" />
              Filtreler
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="space-y-2">
                <Label className="text-zinc-600 dark:text-zinc-400">Kullanıcı</Label>
                <select
                  value={filters.userId}
                  onChange={(e) => updateParams("userId", e.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">Tümü</option>
                  {activityUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {user.surname}
                      {user.role === "ADMIN" ? " (Admin)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-600 dark:text-zinc-400">Varlık</Label>
                <select
                  value={filters.entity}
                  onChange={(e) => updateParams("entity", e.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">Tümü</option>
                  {filterOptions.entities.map((entity) => (
                    <option key={entity} value={entity}>
                      {formatEntity(entity)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-600 dark:text-zinc-400">İşlem</Label>
                <select
                  value={filters.action}
                  onChange={(e) => updateParams("action", e.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">Tümü</option>
                  {filterOptions.actions.map((action) => (
                    <option key={action} value={action}>
                      {formatAction(action)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-600 dark:text-zinc-400">Başlangıç</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateParams("dateFrom", e.target.value)}
                  className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-600 dark:text-zinc-400">Bitiş</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateParams("dateTo", e.target.value)}
                  className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-600 dark:text-zinc-400">Ara</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="search"
                    placeholder="İşlem, kullanıcı, IP..."
                    defaultValue={filters.search}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateParams("search", e.currentTarget.value);
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value !== filters.search) {
                        updateParams("search", e.target.value);
                      }
                    }}
                    className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                  />
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="border-zinc-300 dark:border-zinc-700"
                >
                  Filtreleri Temizle
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>

      <BlurFade delay={0.15}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Tarih
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Kullanıcı
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      İşlem
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Varlık
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Detay
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <ScrollText className="h-8 w-8 text-zinc-400" />
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Aktivite kaydı bulunamadı
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.map((log) => {
                      const fullName = `${log.user.name} ${log.user.surname}`.trim();
                      const entityLink = getEntityLink(log.entity, log.entityId);
                      const detailsText = formatDetails(log.details);

                      return (
                        <tr
                          key={log.id}
                          className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="p-4">
                            <div>
                              <p className="text-sm text-zinc-900 dark:text-white">
                                {new Date(log.createdAt).toLocaleDateString("tr-TR")}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {new Date(log.createdAt).toLocaleTimeString("tr-TR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5">
                                {log.user.role === "ADMIN" ? (
                                  <Shield className="h-4 w-4 text-purple-500" />
                                ) : (
                                  <User className="h-4 w-4 text-blue-500" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                  {fullName || log.user.email}
                                </p>
                                <p className="text-xs text-zinc-500">{log.user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {formatAction(log.action)}
                            </span>
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="text-sm text-zinc-900 dark:text-white">
                                {formatEntity(log.entity)}
                              </p>
                              {entityLink ? (
                                <Link
                                  href={entityLink}
                                  className="text-xs text-primary hover:underline"
                                >
                                  {log.entityId}
                                </Link>
                              ) : log.entityId ? (
                                <p className="text-xs text-zinc-500 font-mono">{log.entityId}</p>
                              ) : null}
                            </div>
                          </td>
                          <td className="p-4 max-w-xs">
                            <p
                              className="text-xs text-zinc-600 dark:text-zinc-400 truncate"
                              title={detailsText}
                            >
                              {detailsText}
                            </p>
                          </td>
                          <td className="p-4">
                            {log.ipAddress ? (
                              <span className="inline-flex items-center gap-1 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                                <Globe className="h-3 w-3" />
                                {log.ipAddress}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-500">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-sm text-zinc-500">
                  Toplam {total.toLocaleString("tr-TR")} kayıt, sayfa {page}/{totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => updateParams("page", String(page - 1))}
                    className="border-zinc-300 dark:border-zinc-700"
                  >
                    Önceki
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => updateParams("page", String(page + 1))}
                    className="border-zinc-300 dark:border-zinc-700"
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}