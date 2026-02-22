"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  MoreHorizontal,
  Eye,
  Mail,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  TrendingUp,
  AlertTriangle,
  Building2,
  Plus,
  Receipt,
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

const invoices = [
  {
    id: "F-2024-0201",
    customer: "Ahmet Yılmaz",
    customerId: "M-001",
    companyName: null,
    amount: 647,
    status: "paid",
    createdAt: "2024-06-15",
    dueDate: "2024-06-30",
    paidAt: "2024-06-18",
  },
  {
    id: "F-2024-0200",
    customer: "Ayşe Demir",
    customerId: "M-002",
    companyName: "Demir Holding A.Ş.",
    amount: 1250,
    status: "pending",
    createdAt: "2024-06-14",
    dueDate: "2024-06-29",
    paidAt: null,
  },
  {
    id: "F-2024-0199",
    customer: "Mehmet Kaya",
    customerId: "M-003",
    companyName: "KayaSoft Ltd.",
    amount: 899,
    status: "overdue",
    createdAt: "2024-05-20",
    dueDate: "2024-06-05",
    paidAt: null,
  },
  {
    id: "F-2024-0198",
    customer: "Fatma Şahin",
    customerId: "M-004",
    companyName: null,
    amount: 299,
    status: "pending",
    createdAt: "2024-06-10",
    dueDate: "2024-06-25",
    paidAt: null,
  },
  {
    id: "F-2024-0197",
    customer: "Zeynep Arslan",
    customerId: "M-006",
    companyName: "Arslan Group",
    amount: 599,
    status: "paid",
    createdAt: "2024-06-08",
    dueDate: "2024-06-23",
    paidAt: "2024-06-10",
  },
  {
    id: "F-2024-0196",
    customer: "Ali Yıldız",
    customerId: "M-007",
    companyName: null,
    amount: 449,
    status: "cancelled",
    createdAt: "2024-06-05",
    dueDate: "2024-06-20",
    paidAt: null,
  },
  {
    id: "F-2024-0195",
    customer: "Elif Çelik",
    customerId: "M-008",
    companyName: "Çelik Tech",
    amount: 1850,
    status: "paid",
    createdAt: "2024-06-01",
    dueDate: "2024-06-16",
    paidAt: "2024-06-03",
  },
  {
    id: "F-2024-0194",
    customer: "Can Özkan",
    customerId: "M-009",
    companyName: null,
    amount: 749,
    status: "overdue",
    createdAt: "2024-05-25",
    dueDate: "2024-06-10",
    paidAt: null,
  },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  paid: { label: "Ödendi", color: "bg-green-500/10 text-green-600 dark:text-green-500", icon: CheckCircle },
  pending: { label: "Bekliyor", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500", icon: Clock },
  overdue: { label: "Gecikmiş", color: "bg-red-500/10 text-red-600 dark:text-red-500", icon: AlertTriangle },
  cancelled: { label: "İptal", color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-500", icon: XCircle },
};

const statusFilters = [
  { value: "all", label: "Tümü", icon: Receipt },
  { value: "paid", label: "Ödendi", icon: CheckCircle },
  { value: "pending", label: "Bekliyor", icon: Clock },
  { value: "overdue", label: "Gecikmiş", icon: AlertTriangle },
  { value: "cancelled", label: "İptal", icon: XCircle },
];

export default function InvoicesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.companyName && invoice.companyName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(price);
  };

  // Stats
  const totalRevenue = invoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + inv.amount, 0);
  const pendingAmount = invoices.filter(inv => inv.status === "pending").reduce((sum, inv) => sum + inv.amount, 0);
  const overdueAmount = invoices.filter(inv => inv.status === "overdue").reduce((sum, inv) => sum + inv.amount, 0);

  // Status counts
  const statusCounts = statusFilters.reduce((acc, filter) => {
    if (filter.value === "all") {
      acc[filter.value] = invoices.length;
    } else {
      acc[filter.value] = invoices.filter(inv => inv.status === filter.value).length;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Faturalar</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Tüm faturaları yönetin ve takip edin</p>
          </div>
          <Link href="/yonetim/faturalar/olustur">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Fatura Oluştur
            </Button>
          </Link>
        </div>
      </BlurFade>

      {/* Stats Cards */}
      <BlurFade delay={0.05}>
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Bu Ay Gelir</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">{formatPrice(totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Ödenen</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">{statusCounts.paid} Fatura</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Bekleyen</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">{formatPrice(pendingAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Gecikmiş</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">{formatPrice(overdueAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      {/* Filters */}
      <BlurFade delay={0.1}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Status Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((filter) => {
                  const Icon = filter.icon;
                  const count = statusCounts[filter.value] || 0;
                  return (
                    <Button
                      key={filter.value}
                      size="sm"
                      variant={statusFilter === filter.value ? "default" : "outline"}
                      onClick={() => setStatusFilter(filter.value)}
                      className={cn(
                        "gap-2",
                        statusFilter === filter.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {filter.label}
                      <span className={cn(
                        "ml-1 px-1.5 py-0.5 rounded text-xs",
                        statusFilter === filter.value
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                      )}>
                        {count}
                      </span>
                    </Button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="flex-1 md:max-w-xs md:ml-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="search"
                    placeholder="Fatura no, müşteri ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Table */}
      <BlurFade delay={0.15}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Fatura No</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Müşteri</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tutar</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Oluşturma</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Son Ödeme</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="h-8 w-8 text-zinc-400" />
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Sonuç bulunamadı
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const StatusIcon = statusConfig[invoice.status].icon;
                      return (
                        <tr
                          key={invoice.id}
                          className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="p-4">
                            <Link
                              href={`/yonetim/faturalar/${invoice.id}`}
                              className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary transition-colors"
                            >
                              {invoice.id}
                            </Link>
                          </td>
                          <td className="p-4">
                            <div>
                              <Link
                                href={`/yonetim/musteriler/${invoice.customerId}`}
                                className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary transition-colors"
                              >
                                {invoice.customer}
                              </Link>
                              {invoice.companyName && (
                                <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                  <Building2 className="h-3 w-3" />
                                  {invoice.companyName}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "text-sm font-medium",
                              invoice.status === "cancelled" ? "text-zinc-500 line-through" : "text-zinc-900 dark:text-white"
                            )}>
                              {formatPrice(invoice.amount)}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                              statusConfig[invoice.status].color
                            )}>
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig[invoice.status].label}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                              {new Date(invoice.createdAt).toLocaleDateString("tr-TR")}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "text-sm",
                              invoice.status === "overdue" ? "text-red-600 dark:text-red-500 font-medium" : "text-zinc-600 dark:text-zinc-400"
                            )}>
                              {new Date(invoice.dueDate).toLocaleDateString("tr-TR")}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                <DropdownMenuItem asChild>
                                  <Link href={`/yonetim/faturalar/${invoice.id}`} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                                    <Eye className="h-4 w-4" />
                                    Detayları Gör
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => window.open(`/api/faturalar/${invoice.id}/pdf`, '_blank')}
                                  className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                >
                                  <Download className="h-4 w-4" />
                                  PDF İndir
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => alert(`${invoice.customer} müşterisine hatırlatma e-postası gönderildi`)}
                                  className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                >
                                  <Mail className="h-4 w-4" />
                                  Hatırlatma Gönder
                                </DropdownMenuItem>
                                {invoice.status === "pending" && (
                                  <>
                                    <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                                    <DropdownMenuItem
                                      onClick={() => alert(`Fatura ${invoice.id} ödendi olarak işaretlendi`)}
                                      className="flex items-center gap-2 text-green-600 dark:text-green-500 cursor-pointer"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                      Ödendi İşaretle
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
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
