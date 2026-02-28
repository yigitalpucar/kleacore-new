"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  UserCheck,
  CheckCircle,
  Pause,
  Clock,
  UserX,
  MoreHorizontal,
  Eye,
  Mail,
  FileText,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import { useCustomerActions } from "../use-customer-actions";

interface CustomerItem {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone: string | null;
  status: string;
  customerType: string | null;
  companyName: string | null;
  balance: unknown;
  createdAt: Date;
  _count: {
    orders: number;
    services: number;
    tickets: number;
  };
}

interface IndividualCustomersContentProps {
  data: CustomerItem[];
  total: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Aktif", color: "bg-green-500/10 text-green-500" },
  SUSPENDED: { label: "Askıda", color: "bg-orange-500/10 text-orange-500" },
  CLOSED: { label: "Kapalı", color: "bg-red-500/10 text-red-500" },
};

export function IndividualCustomersContent({ data, total }: IndividualCustomersContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const {
    handleSuspendCustomer,
    handleActivateCustomer,
    handleCloseCustomer,
  } = useCustomerActions();

  const filteredCustomers = data.filter((customer) => {
    const fullName = `${customer.name} ${customer.surname}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || customer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = data.filter((c) => c.status === "ACTIVE").length;
  const suspendedCount = data.filter((c) => c.status === "SUSPENDED").length;
  const closedCount = data.filter((c) => c.status === "CLOSED").length;

  const statCards = [
    {
      title: "Toplam Bireysel",
      value: total.toLocaleString("tr-TR"),
      icon: UserCheck,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      title: "Aktif",
      value: activeCount.toLocaleString("tr-TR"),
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Askıda",
      value: suspendedCount.toLocaleString("tr-TR"),
      icon: Pause,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Kapalı",
      value: closedCount.toLocaleString("tr-TR"),
      icon: Clock,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ];

  const statusFilters = [
    { value: "all", label: "Tüm Durumlar", count: data.length },
    { value: "ACTIVE", label: "Aktif", count: activeCount, color: "text-green-500" },
    { value: "SUSPENDED", label: "Askıda", count: suspendedCount, color: "text-orange-500" },
    { value: "CLOSED", label: "Kapalı", count: closedCount, color: "text-red-500" },
  ];

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Bireysel Müşteriler</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Kurumsal olmayan bireysel müşteriler</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10">
            <UserCheck className="h-5 w-5 text-cyan-500" />
            <span className="text-sm font-medium text-cyan-500">{total.toLocaleString("tr-TR")} Bireysel</span>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <BlurFade key={stat.title} delay={0.05 + index * 0.05}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-lg", stat.bgColor)}>
                    <stat.icon className={cn("h-6 w-6", stat.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{stat.title}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        ))}
      </div>

      <BlurFade delay={0.25}>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                statusFilter === filter.value
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              {filter.label}
              <span className={cn(
                "ml-2 px-1.5 py-0.5 rounded text-xs",
                statusFilter === filter.value
                  ? "bg-white dark:bg-zinc-900 text-primary"
                  : filter.color || "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
              )}>
                {filter.count}
              </span>
            </Button>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.3}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                type="search"
                placeholder="İsim, e-posta veya müşteri ID ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
              />
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      <BlurFade delay={0.35}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Adı Soyadı</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">E-Posta</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Telefon</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kayıt Tarihi</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <UserX className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                          <p className="text-zinc-500 dark:text-zinc-400">Müşteri bulunamadı</p>
                          <p className="text-sm text-zinc-400 dark:text-zinc-500">Arama kriterlerinizi değiştirmeyi deneyin</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="p-4">
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">
                            {customer.name} {customer.surname}
                          </p>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">{customer.email}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">{customer.phone || "-"}</span>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-zinc-900 dark:text-white">
                            {new Date(customer.createdAt).toLocaleDateString("tr-TR")}
                          </p>
                        </td>
                        <td className="p-4">
                          <span className={cn(
                            "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                            statusConfig[customer.status]?.color || "bg-zinc-500/10 text-zinc-500"
                          )}>
                            {statusConfig[customer.status]?.label || customer.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                              <DropdownMenuItem asChild>
                                <Link href={`/yonetim/musteriler/${customer.id}`} className="flex items-center cursor-pointer">
                                  <Eye className="mr-2 h-4 w-4" />
                                  Detayları Görüntüle
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="flex items-center cursor-pointer">
                                <Mail className="mr-2 h-4 w-4" />
                                E-posta Gönder
                              </DropdownMenuItem>
                              <DropdownMenuItem className="flex items-center cursor-pointer">
                                <FileText className="mr-2 h-4 w-4" />
                                Fatura Oluştur
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                              <DropdownMenuItem className="flex items-center cursor-pointer">
                                <Clock className="mr-2 h-4 w-4" />
                                Aktivite Geçmişi
                              </DropdownMenuItem>
                              {customer.status === "ACTIVE" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    void handleSuspendCustomer(customer.id);
                                  }}
                                  className="flex items-center cursor-pointer text-orange-600 dark:text-orange-500"
                                >
                                  <Pause className="mr-2 h-4 w-4" />
                                  Hesabı Askıya Al
                                </DropdownMenuItem>
                              )}
                              {customer.status === "SUSPENDED" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    void handleActivateCustomer(customer.id);
                                  }}
                                  className="flex items-center cursor-pointer text-green-600 dark:text-green-500"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Hesabı Aktif Et
                                </DropdownMenuItem>
                              )}
                              {customer.status !== "CLOSED" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    void handleCloseCustomer(customer.id);
                                  }}
                                  className="flex items-center cursor-pointer text-red-600 dark:text-red-500"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Hesabı Kapat
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
