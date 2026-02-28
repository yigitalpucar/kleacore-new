"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle,
  MoreHorizontal,
  Eye,
  Download,
  Mail,
  TrendingUp,
  Calendar,
  Receipt,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sendInvoiceReceipt } from "@/lib/actions/admin/invoices";
import { toast } from "@/lib/toast";

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  createdAt: Date;
  dueDate: Date;
  paidAt: Date | null;
  customer: {
    id: string;
    name: string;
    surname: string;
    email: string;
  };
}

interface PaidInvoicesContentProps {
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

export function PaidInvoicesContent({ data, total }: PaidInvoicesContentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSendReceipt = async (id: string) => {
    const result = await sendInvoiceReceipt(id);
    if (!result.success) {
      toast.error(result.error ?? "Makbuz gönderilemedi");
      return;
    }
    toast.success(result.message ?? "Makbuz gönderildi");
  };

  const filteredInvoices = data.filter((invoice) => {
    const fullName = `${invoice.customer.name} ${invoice.customer.surname}`;
    return (
      fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalAmount = data.reduce((sum, inv) => sum + inv.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Ödenen Faturalar</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Ödemesi tamamlanmış faturalar</p>
        </div>
      </BlurFade>

      {/* Stats Cards */}
      <BlurFade delay={0.05}>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Ödenen</p>
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Receipt className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Ort. Tutar</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">
                    {total > 0 ? formatPrice(totalAmount / total) : formatPrice(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      {/* Search */}
      <BlurFade delay={0.1}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex-1 md:max-w-xs">
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
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Oluşturma</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Ödeme Tarihi</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle className="h-8 w-8 text-zinc-400" />
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
                            <span className="text-sm font-medium text-green-600 dark:text-green-500">
                              {formatPrice(invoice.totalAmount)}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                              {new Date(invoice.createdAt).toLocaleDateString("tr-TR")}
                            </span>
                          </td>
                          <td className="p-4">
                            {invoice.paidAt ? (
                              <span className="text-sm text-green-600 dark:text-green-500 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(invoice.paidAt).toLocaleDateString("tr-TR")}
                              </span>
                            ) : (
                              <span className="text-sm text-zinc-500">-</span>
                            )}
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
                                  onClick={() => handleSendReceipt(invoice.id)}
                                  className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                >
                                  <Mail className="h-4 w-4" />
                                  Makbuz Gönder
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
