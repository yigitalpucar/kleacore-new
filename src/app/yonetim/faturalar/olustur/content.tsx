"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  User,
  Package,
  Calendar,
  Search,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { BlurFade } from "@/components/magicui/blur-fade";
import { cn } from "@/lib/utils";
import { createInvoice } from "@/lib/actions/admin/invoices";

interface CustomerOption {
  id: string;
  name: string;
  email: string;
}

interface CreateInvoiceContentProps {
  customers: CustomerOption[];
}

export function CreateInvoiceContent({ customers }: CreateInvoiceContentProps) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState([
    { id: 1, description: "", quantity: 1, unitPrice: 0 },
  ]);

  const addItem = () => {
    setItems([...items, { id: Date.now(), description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: number, field: string, value: string | number) => {
    setItems(items.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(price);
  };

  const handleSubmit = async () => {
    if (!customerId || !dueDate || items.some((i) => !i.description || i.unitPrice <= 0)) return;
    setSubmitting(true);
    const result = await createInvoice({
      customerId,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount: total,
      dueDate,
      notes: notes || undefined,
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
      })),
    });
    setSubmitting(false);
    if (result.success && result.data) {
      router.push(`/yonetim/faturalar/${result.data.id}`);
    }
  };

  // Müşteri filtreleme
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Seçili müşteri bilgisi
  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="space-y-6">
      <Link
        href="/yonetim/faturalar"
        className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Faturalara Dön
      </Link>

      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Yeni Fatura Oluştur</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Manuel fatura oluşturma formu</p>
        </div>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <BlurFade delay={0.1}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Müşteri Seçimi
                </CardTitle>
                <CardDescription className="text-zinc-500">
                  Faturanın kesileceği müşteriyi seçin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Müşteri ara..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-10 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="grid gap-2 max-h-48 overflow-y-auto">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setCustomerId(customer.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                        customerId === customer.id
                          ? "border-primary bg-primary/5"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-medium">
                          {customer.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className={cn(
                            "text-sm font-medium",
                            customerId === customer.id ? "text-primary" : "text-zinc-900 dark:text-white"
                          )}>
                            {customer.name}
                          </p>
                          <p className="text-xs text-zinc-500">{customer.email}</p>
                        </div>
                      </div>
                      {customerId === customer.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500">
                      Müşteri bulunamadı.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          <BlurFade delay={0.2}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Fatura Kalemleri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4 items-start">
                    <div className="flex-1 space-y-2">
                      <Label className="text-zinc-700 dark:text-zinc-300">Açıklama</Label>
                      <Input
                        placeholder="Ürün/Hizmet açıklaması"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="w-24 space-y-2">
                      <Label className="text-zinc-700 dark:text-zinc-300">Adet</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                        className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div className="w-32 space-y-2">
                      <Label className="text-zinc-700 dark:text-zinc-300">Birim Fiyat</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div className="w-32 space-y-2">
                      <Label className="text-zinc-700 dark:text-zinc-300">Toplam</Label>
                      <div className="h-10 flex items-center text-sm font-medium text-zinc-900 dark:text-white">
                        {formatPrice(item.quantity * item.unitPrice)}
                      </div>
                    </div>
                    <div className="pt-8">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeItem(item.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={addItem}
                  className="w-full border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Kalem Ekle
                </Button>
              </CardContent>
            </Card>
          </BlurFade>

          <BlurFade delay={0.3}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Fatura Ayarları
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-zinc-700 dark:text-zinc-300">Son Ödeme Tarihi</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-700 dark:text-zinc-300">KDV Oranı (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-700 dark:text-zinc-300">Not (Opsiyonel)</Label>
                  <Input
                    placeholder="Fatura notu..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                  />
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </div>

        <div className="space-y-6">
          <BlurFade delay={0.4}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 sticky top-6">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base">Fatura Özeti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedCustomer && (
                  <>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {selectedCustomer.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">{selectedCustomer.name}</p>
                        <p className="text-xs text-zinc-500">{selectedCustomer.email}</p>
                      </div>
                    </div>
                    <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                  </>
                )}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Ara Toplam</span>
                    <span className="text-zinc-900 dark:text-white">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">KDV (%{taxRate})</span>
                    <span className="text-zinc-900 dark:text-white">{formatPrice(taxAmount)}</span>
                  </div>
                  <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                  <div className="flex justify-between">
                    <span className="font-medium text-zinc-900 dark:text-white">Toplam</span>
                    <span className="text-xl font-bold text-zinc-900 dark:text-white">{formatPrice(total)}</span>
                  </div>
                </div>
                <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                <Button
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleSubmit}
                  disabled={submitting || !customerId || !dueDate}
                >
                  {submitting ? "Oluşturuluyor..." : "Fatura Oluştur"}
                </Button>
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
