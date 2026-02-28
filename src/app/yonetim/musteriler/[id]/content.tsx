"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Package,
  FileText,
  Headphones,
  Edit,
  Ban,
  CheckCircle,
  XCircle,
  CreditCard,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import { useCustomerActions } from "../use-customer-actions";
import { updateCustomer } from "@/lib/actions/admin/customers";
import { toast } from "@/lib/toast";

interface CustomerDetailContentProps {
  customer: {
    id: string;
    email: string;
    name: string;
    surname: string;
    phone: string | null;
    status: string;
    customerType: string | null;
    companyName: string | null;
    taxNumber: string | null;
    address: string | null;
    city: string | null;
    balance: unknown;
    createdAt: Date;
    updatedAt: Date;
    orders: Array<{
      id: string;
      createdAt: Date;
      status: string;
      total: unknown;
      product: { name: string } | null;
    }>;
    services: Array<{
      id: string;
      status: string;
      expiresAt: Date | null;
      product: { name: string } | null;
    }>;
    invoices: Array<{
      id: string;
      createdAt: Date;
      status: string;
      total: unknown;
      invoiceNumber: string | null;
    }>;
    tickets: Array<{
      id: string;
      subject: string;
      status: string;
      priority: string;
      createdAt: Date;
    }>;
    transactions: Array<{
      id: string;
      type: string;
      amount: unknown;
      description: string | null;
      createdAt: Date;
    }>;
  };
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE: { label: "Aktif", variant: "default" },
  SUSPENDED: { label: "Askıda", variant: "destructive" },
  CLOSED: { label: "Kapalı", variant: "secondary" },
  PAID: { label: "Ödendi", variant: "default" },
  UNPAID: { label: "Ödenmedi", variant: "destructive" },
  PENDING: { label: "Beklemede", variant: "secondary" },
  OPEN: { label: "Açık", variant: "secondary" },
  RESOLVED: { label: "Çözüldü", variant: "default" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  HIGH: { label: "Yüksek", color: "text-red-500" },
  MEDIUM: { label: "Orta", color: "text-yellow-500" },
  LOW: { label: "Düşük", color: "text-green-500" },
};

export function CustomerDetailContent({ customer }: CustomerDetailContentProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const fullName = `${customer.name} ${customer.surname}`;
  const initials = `${customer.name[0] || ""}${customer.surname[0] || ""}`;
  const balance = Number(customer.balance || 0);
  const {
    handleSuspendCustomer,
    handleActivateCustomer,
    handleCloseCustomer,
  } = useCustomerActions();

  const handleUpdateCustomer = async () => {
    if (isUpdating) return;

    const name = prompt("Ad", customer.name);
    if (name === null) return;

    const surname = prompt("Soyad", customer.surname);
    if (surname === null) return;

    const phone = prompt("Telefon", customer.phone ?? "");
    if (phone === null) return;

    const companyName = prompt("Şirket Adı", customer.companyName ?? "");
    if (companyName === null) return;

    const taxNumber = prompt("Vergi Numarası", customer.taxNumber ?? "");
    if (taxNumber === null) return;

    const address = prompt("Adres", customer.address ?? "");
    if (address === null) return;

    const city = prompt("Şehir", customer.city ?? "");
    if (city === null) return;

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("surname", surname.trim());
    formData.set("phone", phone.trim());
    formData.set("customerType", customer.customerType ?? "INDIVIDUAL");
    formData.set("companyName", companyName.trim());
    formData.set("taxNumber", taxNumber.trim());
    formData.set("address", address.trim());
    formData.set("city", city.trim());

    setIsUpdating(true);
    const result = await updateCustomer(customer.id, formData);
    if (!result.success) {
      toast.error(result.error ?? "Müşteri güncellenemedi");
      setIsUpdating(false);
      return;
    }

    toast.success("Müşteri bilgileri güncellendi");
    setIsUpdating(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Link
        href="/yonetim/musteriler"
        className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Müşterilere Dön
      </Link>

      <BlurFade delay={0}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white text-2xl font-bold">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{fullName}</h1>
                <Badge variant={statusConfig[customer.status]?.variant || "secondary"}>
                  {statusConfig[customer.status]?.label || customer.status}
                </Badge>
              </div>
              {customer.companyName && (
                <p className="text-zinc-600 dark:text-zinc-400">{customer.companyName}</p>
              )}
              <p className="text-sm text-zinc-500">Müşteri ID: {customer.id}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void handleUpdateCustomer();
              }}
              disabled={isUpdating}
              className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
            >
              <Edit className="mr-2 h-4 w-4" />
              {isUpdating ? "Kaydediliyor..." : "Düzenle"}
            </Button>
            <Button
              variant="outline"
              asChild
              className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
            >
              <Link href={`mailto:${customer.email}`}>
                <Mail className="mr-2 h-4 w-4" />
                E-posta Gönder
              </Link>
            </Button>
            {customer.status === "ACTIVE" ? (
              <Button
                variant="destructive"
                onClick={() => {
                  void handleSuspendCustomer(customer.id);
                }}
              >
                <Ban className="mr-2 h-4 w-4" />
                Askıya Al
              </Button>
            ) : customer.status === "SUSPENDED" ? (
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  void handleActivateCustomer(customer.id);
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Aktif Et
              </Button>
            ) : null}
            {customer.status !== "CLOSED" && (
              <Button
                variant="outline"
                className="border-red-500/40 text-red-500 hover:bg-red-500/10"
                onClick={() => {
                  void handleCloseCustomer(customer.id);
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Hesabı Kapat
              </Button>
            )}
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <BlurFade delay={0.05}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base">İletişim Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-zinc-500" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{customer.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-zinc-500" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{customer.phone || "-"}</span>
                </div>
                {customer.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-zinc-500 mt-0.5" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {customer.address}{customer.city ? `, ${customer.city}` : ""}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </BlurFade>

          <BlurFade delay={0.1}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base">Hesap Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Bakiye</span>
                  <span className={cn(
                    "text-sm font-medium",
                    balance >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {balance.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                  </span>
                </div>
                {customer.taxNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500">Vergi No</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{customer.taxNumber}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Müşteri Tipi</span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {customer.customerType === "CORPORATE" ? "Kurumsal" : "Bireysel"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Kayıt Tarihi</span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {new Date(customer.createdAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </div>

        <div className="lg:col-span-2">
          <BlurFade delay={0.2}>
            <Tabs defaultValue="services" className="w-full">
              <TabsList className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <TabsTrigger value="services" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700">
                  <Package className="mr-2 h-4 w-4" />
                  Hizmetler ({customer.services.length})
                </TabsTrigger>
                <TabsTrigger value="invoices" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700">
                  <FileText className="mr-2 h-4 w-4" />
                  Faturalar ({customer.invoices.length})
                </TabsTrigger>
                <TabsTrigger value="tickets" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700">
                  <Headphones className="mr-2 h-4 w-4" />
                  Destek ({customer.tickets.length})
                </TabsTrigger>
                <TabsTrigger value="transactions" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700">
                  <CreditCard className="mr-2 h-4 w-4" />
                  İşlemler ({customer.transactions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="services" className="mt-4">
                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <CardContent className="p-0">
                    {customer.services.length === 0 ? (
                      <div className="p-8 text-center text-zinc-500">Henüz hizmet bulunmuyor</div>
                    ) : (
                      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {customer.services.map((service) => (
                          <div key={service.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <div>
                              <Link
                                href={`/yonetim/hizmetler/${service.id}`}
                                className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary"
                              >
                                {service.product?.name || "Hizmet"}
                              </Link>
                            </div>
                            <div className="flex items-center gap-4">
                              {service.expiresAt && (
                                <p className="text-xs text-zinc-500">
                                  Bitiş: {new Date(service.expiresAt).toLocaleDateString("tr-TR")}
                                </p>
                              )}
                              <Badge variant={statusConfig[service.status]?.variant || "secondary"}>
                                {statusConfig[service.status]?.label || service.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="invoices" className="mt-4">
                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <CardContent className="p-0">
                    {customer.invoices.length === 0 ? (
                      <div className="p-8 text-center text-zinc-500">Henüz fatura bulunmuyor</div>
                    ) : (
                      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {customer.invoices.map((invoice) => (
                          <div key={invoice.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <div>
                              <Link
                                href={`/yonetim/faturalar/${invoice.id}`}
                                className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary"
                              >
                                {invoice.invoiceNumber || invoice.id}
                              </Link>
                              <p className="text-xs text-zinc-500">
                                {new Date(invoice.createdAt).toLocaleDateString("tr-TR")}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                {Number(invoice.total || 0).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                              </span>
                              <Badge variant={statusConfig[invoice.status]?.variant || "secondary"}>
                                {statusConfig[invoice.status]?.label || invoice.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tickets" className="mt-4">
                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <CardContent className="p-0">
                    {customer.tickets.length === 0 ? (
                      <div className="p-8 text-center text-zinc-500">Henüz destek talebi bulunmuyor</div>
                    ) : (
                      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {customer.tickets.map((ticket) => (
                          <div key={ticket.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <div>
                              <Link
                                href={`/yonetim/destek/${ticket.id}`}
                                className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary"
                              >
                                {ticket.subject}
                              </Link>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-zinc-500">{ticket.id}</span>
                                <span className={cn("text-xs", priorityConfig[ticket.priority]?.color || "text-zinc-500")}>
                                  {priorityConfig[ticket.priority]?.label || ticket.priority}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-zinc-500">
                                {new Date(ticket.createdAt).toLocaleDateString("tr-TR")}
                              </span>
                              <Badge variant={statusConfig[ticket.status]?.variant || "secondary"}>
                                {statusConfig[ticket.status]?.label || ticket.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transactions" className="mt-4">
                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <CardContent className="p-0">
                    {customer.transactions.length === 0 ? (
                      <div className="p-8 text-center text-zinc-500">Henüz işlem bulunmuyor</div>
                    ) : (
                      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {customer.transactions.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <div>
                              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                {tx.description || tx.type}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {new Date(tx.createdAt).toLocaleDateString("tr-TR")}
                              </p>
                            </div>
                            <span className={cn(
                              "text-sm font-medium",
                              tx.type === "CREDIT" ? "text-green-500" : "text-red-500"
                            )}>
                              {tx.type === "CREDIT" ? "+" : "-"}
                              {Number(tx.amount || 0).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
