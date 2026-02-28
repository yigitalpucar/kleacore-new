"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Clock,
  Building2,
  Mail,
  CheckCircle,
  MoreHorizontal,
  Eye,
  Download,
  AlertTriangle,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlurFade } from "@/components/magicui/blur-fade";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markPaid, sendInvoiceReminder } from "@/lib/actions/admin/invoices";
import { toast } from "@/lib/toast";

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
  dueDate: Date;
  customer: {
    id: string;
    name: string;
    surname: string;
    email: string;
  };
}

interface PendingInvoicesContentProps {
  data: Invoice[];
  total: number;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);
};

function getDaysLeft(dueDate: Date): number {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

const urgencyFilters = [
  { value: "all", label: "Tümü", icon: Clock },
  { value: "critical", label: "Kritik (1-2 gün)", icon: AlertTriangle },
  { value: "warning", label: "Yaklaşan (3-5 gün)", icon: Timer },
  { value: "normal", label: "Normal (6+ gün)", icon: CheckCircle },
];

export function PendingInvoicesContent({ data, total }: PendingInvoicesContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");

  const handleMarkPaid = async (id: string) => {
    const result = await markPaid(id);
    if (!result.success) {
      toast.error(result.error ?? "Fatura durumu güncellenemedi");
      return;
    }
    toast.success("Fatura ödendi olarak işaretlendi");
  };

  const handleSendReminder = async (id: string) => {
    const result = await sendInvoiceReminder(id);
    if (!result.success) {
      toast.error(result.error ?? "Hatırlatma gönderilemedi");
      return;
    }
    toast.success(result.message ?? "Hatırlatma gönderildi");
  };

  const invoicesWithDays = data.map((inv) => ({
    ...inv,
    daysLeft: getDaysLeft(inv.dueDate),
  }));

  const filteredInvoices = invoicesWithDays.filter((invoice) => {
    const fullName = `${invoice.customer.name} ${invoice.customer.surname}`;
    const matchesSearch =
      fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer.email.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesUrgency = true;
    if (urgencyFilter === "critical") {
      matchesUrgency = invoice.daysLeft <= 2;
    } else if (urgencyFilter === "warning") {
      matchesUrgency = invoice.daysLeft >= 3 && invoice.daysLeft <= 5;
    } else if (urgencyFilter === "normal") {
      matchesUrgency = invoice.daysLeft >= 6;
    }

    return matchesSearch && matchesUrgency;
  });

  const totalAmount = invoicesWithDays.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const criticalCount = invoicesWithDays.filter((inv) => inv.daysLeft <= 2).length;
  const warningCount = invoicesWithDays.filter((inv) => inv.daysLeft >= 3 && inv.daysLeft <= 5).length;

  const urgencyCounts: Record<string, number> = {
    all: invoicesWithDays.length,
    critical: criticalCount,
    warning: warningCount,
    normal: invoicesWithDays.filter((inv) => inv.daysLeft >= 6).length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Bekleyen Faturalar</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Ödeme beklenen faturalar</p>
        </div>
      </BlurFade>

      {/* Stats Cards */}
      <BlurFade delay={0.05}>
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Bekleyen</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">{total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Tutar</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">{formatPrice(totalAmount)}</p>
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
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Kritik</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">{criticalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                  <Timer className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Yaklaşan</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">{warningCount}</p>
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
              <div className="flex flex-wrap gap-2">
                {urgencyFilters.map((filter) => {
                  const Icon = filter.icon;
                  const count = urgencyCounts[filter.value] || 0;
                  return (
                    <Button
                      key={filter.value}
                      size="sm"
                      variant={urgencyFilter === filter.value ? "default" : "outline"}
                      onClick={() => setUrgencyFilter(filter.value)}
                      className={cn(
                        "gap-2",
                        urgencyFilter === filter.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {filter.label}
                      <span className={cn(
                        "ml-1 px-1.5 py-0.5 rounded text-xs",
                        urgencyFilter === filter.value
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                      )}>
                        {count}
                      </span>
                    </Button>
                  );
                })}
              </div>

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
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Son Ödeme</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kalan Süre</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Clock className="h-8 w-8 text-zinc-400" />
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Sonuç bulunamadı
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const fullName = `${invoice.customer.name} ${invoice.customer.surname}`;
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
                              {invoice.invoiceNumber}
                            </Link>
                          </td>
                          <td className="p-4">
                            <div>
                              <Link
                                href={`/yonetim/musteriler/${invoice.customer.id}`}
                                className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary transition-colors"
                              >
                                {fullName}
                              </Link>
                              <p className="text-xs text-zinc-500 mt-0.5">{invoice.customer.email}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                              {formatPrice(invoice.totalAmount)}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                              {new Date(invoice.dueDate).toLocaleDateString("tr-TR")}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                              invoice.daysLeft <= 2
                                ? "bg-red-500/10 text-red-600 dark:text-red-500"
                                : invoice.daysLeft <= 5
                                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500"
                                : "bg-green-500/10 text-green-600 dark:text-green-500"
                            )}>
                              {invoice.daysLeft <= 2 && <AlertTriangle className="h-3 w-3" />}
                              {invoice.daysLeft >= 3 && invoice.daysLeft <= 5 && <Timer className="h-3 w-3" />}
                              {invoice.daysLeft >= 6 && <Clock className="h-3 w-3" />}
                              {invoice.daysLeft} gün
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
                                  onClick={() => window.open(`/api/faturalar/${invoice.id}/pdf`, "_blank")}
                                  className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                >
                                  <Download className="h-4 w-4" />
                                  PDF İndir
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleSendReminder(invoice.id)}
                                  className="flex items-center gap-2 text-blue-600 dark:text-blue-500 cursor-pointer"
                                >
                                  <Mail className="h-4 w-4" />
                                  Hatırlatma Gönder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                                <DropdownMenuItem
                                  onClick={() => handleMarkPaid(invoice.id)}
                                  className="flex items-center gap-2 text-green-600 dark:text-green-500 cursor-pointer"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Ödendi İşaretle
                                </DropdownMenuItem>
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
